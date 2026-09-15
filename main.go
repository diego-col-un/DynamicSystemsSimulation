package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type interpretationRequest struct {
	Model            string         `json:"model"`
	IntegrationMethod string        `json:"integrationMethod"`
	TimeStep         float64        `json:"timeStep"`
	Parameters       map[string]any `json:"parameters"`
	ParameterDefinitions map[string]string `json:"parameterDefinitions"`
	Equations        string         `json:"equations"`
	Metrics          map[string]any `json:"metrics"`
	Series           []SeriesPoint  `json:"series"`
}

type SeriesPoint struct {
	Time  float64        `json:"time"`
	State map[string]float64 `json:"state"`
}

type openRouterMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type openRouterRequest struct {
	Model    string                `json:"model"`
	Messages []openRouterMessage `json:"messages"`
}

type openRouterResponse struct {
	Choices []struct {
		Message openRouterMessage `json:"message"`
	} `json:"choices"`
}

const knowledgeDirectory = "knowledge"

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/health", healthHandler)
	mux.HandleFunc("/api/interpret", interpretHandler)
	mux.Handle("/", http.FileServer(http.Dir(".")))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	server := &http.Server{
		Addr:              ":" + port,
		Handler:           withCORS(mux),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      90 * time.Second,
	}

	log.Printf("Dynamic Systems Simulation: http://localhost:%s", port)
	log.Fatal(server.ListenAndServe())
}

func healthHandler(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet {
		writeError(writer, http.StatusMethodNotAllowed, "método no permitido")
		return
	}

	writeJSON(writer, http.StatusOK, map[string]any{
		"ok":                  true,
		"openrouter_configured": os.Getenv("OPENROUTER_API_KEY") != "",
	})
}

func interpretHandler(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		writeError(writer, http.StatusMethodNotAllowed, "método no permitido")
		return
	}
	if os.Getenv("OPENROUTER_API_KEY") == "" {
		writeError(writer, http.StatusServiceUnavailable, "OPENROUTER_API_KEY no está configurada en el backend")
		return
	}

	request.Body = http.MaxBytesReader(writer, request.Body, 256*1024)
	var payload interpretationRequest
	decoder := json.NewDecoder(request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&payload); err != nil {
		writeError(writer, http.StatusBadRequest, "solicitud JSON inválida: "+err.Error())
		return
	}
	if strings.TrimSpace(payload.Model) == "" {
		writeError(writer, http.StatusBadRequest, "el campo model es obligatorio")
		return
	}
	if len(payload.Series) > 120 {
		writeError(writer, http.StatusBadRequest, "la serie no puede superar 120 puntos")
		return
	}

	result, err := askOpenRouter(request.Context(), payload)
	if err != nil {
		log.Printf("OpenRouter interpretation failed: %v", err)
		writeError(writer, http.StatusBadGateway, "no se pudo obtener la interpretación de OpenRouter")
		return
	}

	writeJSON(writer, http.StatusOK, map[string]string{"interpretation": result})
}

func askOpenRouter(ctx context.Context, payload interpretationRequest) (string, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	knowledge := retrieveKnowledge(payload)

	model := os.Getenv("OPENROUTER_MODEL")
	if model == "" {
		model = "openrouter/auto"
	}
	body, err := json.Marshal(openRouterRequest{
		Model: model,
		Messages: []openRouterMessage{
			{Role: "system", Content: "Eres un profesor de dinámica de sistemas y estadística. Interpreta el modelo en español claro. Usa parameterDefinitions para nombrar cada parámetro por su significado real, no te limites a decir a, b, c, d, beta o gamma. El campo integrationMethod indica el método numérico realmente usado y debes mencionarlo explícitamente en la respuesta. En este simulador, si dice Euler explícito, explica que cada estado se actualiza como x(t+dt)=x(t)+f(x,t)*dt y comenta el valor de timeStep. Explica variables, ecuaciones, comportamiento observado, métricas, supuestos y limitaciones. Distingue hechos calculados de hipótesis, no inventes datos ni afirmes causalidad no respaldada. Usa subtítulos breves y máximo 500 palabras."},
			{Role: "user", Content: "Analiza este resumen JSON del simulador:\n" + string(data) + "\n\nContexto recuperado del material de referencia:\n" + knowledge},
		},
	})
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://openrouter.ai/api/v1/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+os.Getenv("OPENROUTER_API_KEY"))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("HTTP-Referer", "http://localhost:8080")
	req.Header.Set("X-Title", "Dynamic Systems Simulation")

	response, err := (&http.Client{Timeout: 75 * time.Second}).Do(req)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()

	responseBody, err := io.ReadAll(io.LimitReader(response.Body, 2*1024*1024))
	if err != nil {
		return "", err
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return "", fmt.Errorf("OpenRouter returned status %d: %s", response.StatusCode, strings.TrimSpace(string(responseBody)))
	}

	var decoded openRouterResponse
	if err := json.Unmarshal(responseBody, &decoded); err != nil {
		return "", err
	}
	if len(decoded.Choices) > 0 && decoded.Choices[0].Message.Content != "" {
		return decoded.Choices[0].Message.Content, nil
	}
	return "", errors.New("OpenRouter response did not contain text")
}

func retrieveKnowledge(payload interpretationRequest) string {
	files, err := filepath.Glob(filepath.Join(knowledgeDirectory, "*.txt"))
	if err != nil || len(files) == 0 {
		return "No hay material de referencia cargado. Basa la respuesta únicamente en los datos del simulador."
	}

	query := strings.ToLower(payload.Model + " " + payload.Equations)
	var selected []string
	for _, file := range files {
		content, readErr := os.ReadFile(file)
		if readErr != nil {
			continue
		}
		chunks := splitKnowledge(string(content), 1800)
		for _, chunk := range chunks {
			score := knowledgeScore(strings.ToLower(chunk), query)
			if score > 0 {
				selected = append(selected, fmt.Sprintf("[%s]\n%s", filepath.Base(file), chunk))
			}
		}
	}

	if len(selected) == 0 {
		return "No se encontraron fragmentos relacionados. Basa la respuesta únicamente en los datos del simulador."
	}
	if len(selected) > 3 {
		selected = selected[:3]
	}
	return strings.Join(selected, "\n\n")
}

func splitKnowledge(content string, size int) []string {
	content = strings.TrimSpace(content)
	var chunks []string
	for len(content) > size {
		cut := strings.LastIndex(content[:size], "\n")
		if cut < size/2 {
			cut = size
		}
		chunks = append(chunks, strings.TrimSpace(content[:cut]))
		content = strings.TrimSpace(content[cut:])
	}
	if content != "" {
		chunks = append(chunks, content)
	}
	return chunks
}

func knowledgeScore(chunk, query string) int {
	terms := strings.Fields(query)
	score := 0
	for _, term := range terms {
		if len(term) >= 5 && strings.Contains(chunk, term) {
			score++
		}
	}
	return score
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Access-Control-Allow-Origin", "*")
		writer.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		if request.Method == http.MethodOptions {
			writer.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(writer, request)
	})
}

func writeJSON(writer http.ResponseWriter, status int, value any) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(value)
}

func writeError(writer http.ResponseWriter, status int, message string) {
	writeJSON(writer, status, map[string]string{"error": message})
}

func init() {
	if workingDirectory, err := os.Getwd(); err == nil {
		if _, err := os.Stat(filepath.Join(workingDirectory, "index.html")); err != nil {
			log.Printf("warning: index.html was not found in %s", workingDirectory)
		}
	}
}
