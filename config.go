package main

import (
	"encoding/json"
	"os"
)

type Config struct {
	Database struct {
		Path string `json:"path"`
	} `json:"database"`
	Servers struct {
		UDP struct {
			Enabled bool `json:"enabled"`
			Port    int  `json:"port"`
		} `json:"udp"`
		TCP struct {
			Enabled bool `json:"enabled"`
			Port    int  `json:"port"`
		} `json:"tcp"`
		TLS struct {
			Enabled  bool   `json:"enabled"`
			Port     int    `json:"port"`
			CertFile string `json:"cert_file"`
			KeyFile  string `json:"key_file"`
		} `json:"tls"`
	} `json:"servers"`
	Web struct {
		Port int `json:"port"`
	} `json:"web"`
	Parsing struct {
		BestEffort     bool `json:"best_effort"`
		RFC3164Enabled bool `json:"rfc3164_enabled"`
		RFC5424Enabled bool `json:"rfc5424_enabled"`
	} `json:"parsing"`
}

func LoadConfig(path string) (*Config, error) {
	config := &Config{}

	// Set defaults
	config.Database.Path = "qlog.db"
	config.Servers.UDP.Enabled = true
	config.Servers.UDP.Port = 514
	config.Servers.TCP.Enabled = true
	config.Servers.TCP.Port = 514
	config.Servers.TLS.Enabled = false
	config.Servers.TLS.Port = 6514
	config.Web.Port = 8080
	config.Parsing.BestEffort = true
	config.Parsing.RFC3164Enabled = true
	config.Parsing.RFC5424Enabled = true

	if path != "" {
		data, err := os.ReadFile(path)
		if err != nil {
			if os.IsNotExist(err) {
				// Create default config file
				if err := SaveConfig(path, config); err != nil {
					return config, nil
				}
				return config, nil
			}
			return nil, err
		}

		if err := json.Unmarshal(data, config); err != nil {
			return nil, err
		}
	}

	return config, nil
}

func SaveConfig(path string, config *Config) error {
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}
