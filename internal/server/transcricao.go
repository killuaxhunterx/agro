package server

import (
	"context"
	"io"
	"math"
	"mime"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"
)

// The ditado por voz (issue #310): every free-text field of a signed-in screen can be
// filled by speaking. The browser records, this route forwards the audio to the
// Transcritor and answers the text — nothing is kept, the text only exists once the person
// saves the form the field belongs to, exactly as if typed.
const (
	// maxAudioBytes bounds one recording. The client stops at 2 minutes; opus in webm runs
	// ~32 kbps (~480 KB for 2 min) and Safari's AAC in mp4 ~128 kbps (~1.9 MB), so 4 MiB is
	// the slowest codec with room to spare. The audio is the raw body — never JSON, so the
	// 128 KiB maxBodyBytes does not apply, the same split readLogo already makes.
	maxAudioBytes = 4 << 20
	// maxDuracaoSegundos is the client's 2-minute ceiling plus the slack of a stop that
	// lands a moment late.
	maxDuracaoSegundos = 130
	// transcricoesPorHora is the per-USER budget. Every recording is a paid call to an
	// external API, which is what makes this the one sessioned route with a rate limit
	// (security.md item 5). An intense RTF uses 10–15; at 2 minutes each, 30 caps a user at
	// one hour of audio per hour.
	transcricoesPorHora = 30
	// transcricaoTimeout stays under cmd/csf's 30 s WriteTimeout, which also has to cover
	// the upload: a call cut by the server's own timeout would answer nothing at all.
	transcricaoTimeout = 25 * time.Second
)

// audioTipos is the closed set of recordings a browser's MediaRecorder produces that the
// transcription API also reads — Chrome/Firefox record webm or ogg, Safari mp4. The type
// is the one the client declared: nothing here is stored or served back, so there is no
// sniffing to defend against, and the API rejects bytes that do not match.
var audioTipos = []string{"audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"}

// Transcritor turns a recording into text. Declared here, at the consumer, and satisfied
// by cmd/csf/transcricao.go's OpenAI client — the same shape ReportMailer has. Exported
// because Config carries it. A nil Transcritor is the graceful-degradation path
// (principles.md): the session says transcricao_disponivel=false, the "Falar" button never
// renders, and this route answers 503.
type Transcritor interface {
	Transcrever(ctx context.Context, audio []byte, contentType string) (string, error)
}

type transcricaoBody struct {
	Texto string `json:"texto"`
}

// Transcrever answers POST /api/transcricoes, behind perfil_editar — the permission all
// five papéis hold, the same reasoning as POST /api/reports: every papel has a free-text
// field. The body is the audio itself; ?duracao_s= is the client's own count of the
// recording's length, read only for the log line.
//
// The log line carries actor_id, actor_empresa_id, duracao_s, bytes and whether it worked
// — never the audio nor the text, which is free text and very possibly the content of an
// RTF (go-patterns.md § Logging). It is a plain log line, not s.audit: a transcription
// changes nothing, and the audit list is for operations that do.
func (s *Server) Transcrever(w http.ResponseWriter, r *http.Request) {
	actor, _ := UserFrom(r.Context())

	if s.cfg.Transcritor == nil {
		respondError(w, http.StatusServiceUnavailable, "transcricao_indisponivel", "Transcrição por voz indisponível.")
		return
	}

	if ok, retryAfter := s.transcricoes.permitir(actor.ID.String()); !ok {
		w.Header().Set("Retry-After", strconv.Itoa(int(math.Ceil(retryAfter.Seconds()))))
		respondError(w, http.StatusTooManyRequests, "too_many_requests", "Muitas gravações seguidas. Tente de novo em alguns minutos.")
		return
	}

	tipo, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	duracao, errDuracao := strconv.Atoi(r.URL.Query().Get("duracao_s"))
	if err != nil || !slices.Contains(audioTipos, tipo) || errDuracao != nil || duracao < 0 || duracao > maxDuracaoSegundos {
		respondError(w, http.StatusBadRequest, "audio_invalido", "Envie uma gravação de até 2 minutos.")
		return
	}
	audio, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxAudioBytes))
	if err != nil || len(audio) == 0 {
		respondError(w, http.StatusBadRequest, "audio_invalido", "Envie uma gravação de até 2 minutos.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), transcricaoTimeout)
	defer cancel()
	texto, err := s.cfg.Transcritor.Transcrever(ctx, audio, tipo)
	texto = strings.TrimSpace(texto)

	s.logger.InfoContext(r.Context(), "transcricao",
		"actor_id", actor.ID, "actor_empresa_id", actor.EmpresaID.String(),
		"duracao_s", duracao, "bytes", len(audio), "ok", err == nil && texto != "")

	if err != nil {
		s.logger.ErrorContext(r.Context(), "transcricao failed", "actor_id", actor.ID, "error", err)
		respondError(w, http.StatusBadGateway, "transcricao_falhou", "Não foi possível transcrever. Tente de novo.")
		return
	}
	if texto == "" {
		respondError(w, http.StatusUnprocessableEntity, "audio_sem_fala", "Não entendemos o áudio. Tente falar mais perto do microfone.")
		return
	}
	respondJSON(w, http.StatusOK, transcricaoBody{Texto: texto})
}
