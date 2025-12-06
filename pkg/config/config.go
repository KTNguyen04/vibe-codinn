package config

import (
	"encoding/json"
	"os"
)

type Config struct {
	Port                  string `json:"port"`
	TickRateMs            int    `json:"tick_rate_ms"`
	PlayerSpeedMs         int    `json:"player_speed_ms"`
	BulletSpeedMultiplier int    `json:"bullet_speed_multiplier"`
	Colors                struct {
		Self  string `json:"self"`
		Rival string `json:"rival"`
	} `json:"colors"`
}

var AppConfig Config

func LoadConfig(path string) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()

	decoder := json.NewDecoder(file)
	err = decoder.Decode(&AppConfig)
	if err != nil {
		return err
	}
	return nil
}
