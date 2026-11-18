package server

import (
	"net"
	"net/http"
	"sync"
	"time"
)

const (
	minute = time.Minute
	hour   = time.Hour
)

// limiter is a fixed-window counter per key (an IP for the sign-in, a user for the paid
// transcription). The only mutable in-process state of the package, behind one mutex.
type limiter struct {
	mu     sync.Mutex
	max    int
	window time.Duration
	hits   map[string]*janela
}

type janela struct {
	inicio time.Time
	n      int
}

func newLimiter(max int, window time.Duration) *limiter {
	return &limiter{max: max, window: window, hits: map[string]*janela{}}
}

// permitir counts one hit for key and answers whether it fits, and if not, how long until
// the window resets.
func (l *limiter) permitir(key string) (bool, time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	if len(l.hits) > 10_000 { // poda simples: janelas vencidas saem
		for k, j := range l.hits {
			if now.Sub(j.inicio) >= l.window {
				delete(l.hits, k)
			}
		}
	}
	j, ok := l.hits[key]
	if !ok || now.Sub(j.inicio) >= l.window {
		l.hits[key] = &janela{inicio: now, n: 1}
		return true, 0
	}
	if j.n >= l.max {
		return false, l.window - now.Sub(j.inicio)
	}
	j.n++
	return true, 0
}

func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
