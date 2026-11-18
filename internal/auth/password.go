// Package auth owns password hashing, sessions and sign-in.
package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	"golang.org/x/crypto/argon2"
)

// Argon2id parameters, per OWASP's minimum recommended configuration
// (m=19456, t=2, p=1). The x/crypto signature is IDKey(password, salt, time,
// memory, threads, keyLen) — time before memory, the reverse of the m=…,t=…
// notation above. Swapping the two compiles and silently weakens the hash.
const (
	argonTime    uint32 = 2
	argonMemory  uint32 = 19 * 1024
	argonThreads uint8  = 1
	argonKeyLen  uint32 = 32
	saltLen             = 16
)

// MinPasswordLength is the product's password floor, in RUNES. It was 15
// until issue #14 (24/08/2026) lowered it to 8, by decision of the
// repository owner; see .claude/rules/security.md § Passwords. This
// comment deliberately does not restate what any norm requires — the
// claim it replaced ("the NIST SP 800-63B-4 floor for single-factor
// authentication") is precisely what the new value contradicts.
const MinPasswordLength = 8

// Sentinels returned by CheckPassword.
var (
	ErrPasswordTooShort  = errors.New("password too short")
	ErrPasswordTooCommon = errors.New("password too common")
)

// blocklist is a short embedded list of guessable strings, matched as a
// SUBSTRING (see CheckPassword below), never by equality.
//
// ponytail: this is deliberately not the ~10k-entry list a formal blocklist
// would use, but the reason is no longer the floor. Until issue #14
// (24/08/2026) the floor was 15 characters and did the filtering by itself:
// almost every entry of a classic top-10k list is shorter than that, so the
// file would have cost ~100 KB to reject nearly nothing. At 8 characters
// that argument is dead — "12345678" and "password" are exactly 8 runes and
// clear every other check in CheckPassword — so the list grew the 8-to-14
// character entries the old floor made unreachable, and stops there. What is
// NOT covered: everything between those entries and a real top-10k list.
// Upgrade path, unchanged: //go:embed a real list filtered to ≥8 characters.
//
// "123456789012345" left the list when "12345678" joined it, and cannot come
// back: the match is a substring, so every password containing the long entry
// contains the short one — it was a line no input could ever reach.
var blocklist = []string{
	"senhasenhasenha",
	"qwertyuiopasdfg",
	"12345678",
	"password",
	"senha123",
	"qwerty123",
	"abc12345",
}

// HashPassword derives an argon2id hash and encodes it as a PHC string:
// $argon2id$v=19$m=19456,t=2,p=1$<b64salt>$<b64key>. Storing the parameters in
// the string is what lets them be raised later without invalidating existing
// hashes: verify reads the parameters back out of the hash it is checking.
func HashPassword(password string) (string, error) {
	salt := make([]byte, saltLen)
	// crypto/rand.Read never returns an error: it fills b entirely or kills
	// the process. The error is ignorable by contract.
	_, _ = rand.Read(salt)

	key := argon2.IDKey([]byte(password), salt, argonTime, argonMemory, argonThreads, argonKeyLen)

	return fmt.Sprintf(
		"$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version,
		argonMemory,
		argonTime,
		argonThreads,
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(key),
	), nil
}

// VerifyPassword recomputes the hash from the parameters and salt encoded in
// the string and compares it in constant time. It never panics and never
// returns an error — any malformed input is simply not a match.
func VerifyPassword(encoded, password string) bool {
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[1] != "argon2id" {
		return false
	}

	var version int
	if _, err := fmt.Sscanf(parts[2], "v=%d", &version); err != nil {
		return false
	}

	var memory, time uint32
	var threads uint8
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &memory, &time, &threads); err != nil {
		return false
	}

	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return false
	}
	key, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return false
	}

	computed := argon2.IDKey([]byte(password), salt, time, memory, threads, uint32(len(key)))
	return subtle.ConstantTimeCompare(computed, key) == 1
}

// CheckPassword enforces the password policy: MinPasswordLength (8 runes)
// plus a short blocklist and containment checks against the account's own email
// local part, name and "agro". A leading or trailing space is
// never trimmed — it is a character the user chose.
func CheckPassword(password, email, name string) error {
	// Runes, not bytes: a pt-BR passphrase is where the two diverge, because
	// every ç and ã costs two bytes. Worst case, len() clears the floor four
	// characters in — "çãõá" is 4 runes and 8 bytes.
	if utf8.RuneCountInString(password) < MinPasswordLength {
		return ErrPasswordTooShort
	}

	lower := strings.ToLower(password)

	for _, common := range blocklist {
		if strings.Contains(lower, common) {
			return ErrPasswordTooCommon
		}
	}

	if strings.Contains(lower, "agro123") {
		return ErrPasswordTooCommon
	}

	if hasLongRepeatedRun(lower) {
		return ErrPasswordTooCommon
	}

	// minIdentifierLen guards the containment checks below: without a floor,
	// an account at a@x.com or named "Ed" would have every password containing
	// that letter rejected, with "escolha uma senha menos óbvia" as the only
	// clue. Three characters is where a substring stops being a coincidence.
	const minIdentifierLen = 3

	if localPart, _, found := strings.Cut(strings.ToLower(email), "@"); found &&
		utf8.RuneCountInString(localPart) >= minIdentifierLen {
		if strings.Contains(lower, localPart) {
			return ErrPasswordTooCommon
		}
	}

	if name = strings.ToLower(strings.TrimSpace(name)); utf8.RuneCountInString(name) >= minIdentifierLen &&
		strings.Contains(lower, name) {
		return ErrPasswordTooCommon
	}

	return nil
}

// hasLongRepeatedRun catches passwords like "aaaaaaaaaaaaaaa" — long enough to
// clear MinPasswordLength, but no more resistant to guessing than a short one.
// It walks runes, not bytes: "ãããããããã" is one repeated character but eight
// alternating bytes, and a byte-wise run counter never fires on it.
func hasLongRepeatedRun(password string) bool {
	const runLen = 8
	run := 1
	var prev rune
	for i, r := range password {
		if i > 0 && r == prev {
			run++
			if run >= runLen {
				return true
			}
		} else {
			run = 1
		}
		prev = r
	}
	return false
}
