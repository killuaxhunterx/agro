package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"

	"github.com/knowrisk/agro/internal/server"
)

var _ server.Transcritor = (*openAITranscritor)(nil)

const (
	openAIBaseURL = "https://api.openai.com"
	// transcricaoModel is the cheapest model with good pt-BR (issue #310). Changing models
	// is this constant.
	transcricaoModel = "gpt-4o-mini-transcribe"
)

// audioExtensao maps the recording's type to a file name the API accepts: it reads the
// format off the EXTENSION of the multipart file, not off its Content-Type. The keys are
// internal/server's own audioTipos — a type missing here is a bug, never a client input.
var audioExtensao = map[string]string{
	"audio/webm": "webm",
	"audio/ogg":  "ogg",
	"audio/mp4":  "mp4",
	"audio/mpeg": "mp3",
	"audio/wav":  "wav",
}

// openAITranscritor calls POST /v1/audio/transcriptions over net/http — one multipart
// request, no SDK (principles.md § KISS: stdlib over libraries). Nothing is kept: the audio
// lives in the request and the text goes back to the handler.
type openAITranscritor struct {
	apiKey  string
	baseURL string
	client  *http.Client
}

// newTranscritor answers nil without OPENAI_API_KEY — an untyped nil, so
// server.Config.Transcritor stays nil and the ditado degrades gracefully. Returning a nil
// *openAITranscritor here would be a non-nil interface and the button would render.
func newTranscritor(cfg config) server.Transcritor {
	if cfg.openAIAPIKey == "" {
		return nil
	}
	// No client timeout: the handler's context carries the deadline.
	return &openAITranscritor{apiKey: cfg.openAIAPIKey, baseURL: openAIBaseURL, client: &http.Client{}}
}

func (t *openAITranscritor) Transcrever(ctx context.Context, audio []byte, contentType string) (string, error) {
	ext, ok := audioExtensao[contentType]
	if !ok {
		return "", fmt.Errorf("transcrever: no file extension for %q", contentType)
	}

	var body bytes.Buffer
	form := multipart.NewWriter(&body)
	for campo, valor := range map[string]string{"model": transcricaoModel, "language": "pt", "response_format": "json"} {
		if err := form.WriteField(campo, valor); err != nil {
			return "", fmt.Errorf("transcrever: write %s: %w", campo, err)
		}
	}
	file, err := form.CreateFormFile("file", "audio."+ext)
	if err != nil {
		return "", fmt.Errorf("transcrever: create file part: %w", err)
	}
	if _, err := file.Write(audio); err != nil {
		return "", fmt.Errorf("transcrever: write audio: %w", err)
	}
	if err := form.Close(); err != nil {
		return "", fmt.Errorf("transcrever: close form: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, t.baseURL+"/v1/audio/transcriptions", &body)
	if err != nil {
		return "", fmt.Errorf("transcrever: build request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+t.apiKey)
	req.Header.Set("Content-Type", form.FormDataContentType())

	resp, err := t.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("transcrever: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		// The API's error body names what it refused (format, size, key) and never echoes
		// the audio; capped so a proxy's HTML page cannot flood the log.
		detalhe, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return "", fmt.Errorf("transcrever: status %d: %s", resp.StatusCode, detalhe)
	}
	var out struct {
		Text string `json:"text"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", fmt.Errorf("transcrever: decode response: %w", err)
	}
	return out.Text, nil
}
