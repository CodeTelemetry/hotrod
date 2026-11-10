package location

import (
	"context"
	"go.opentelemetry.io/otel/baggage"
	"os"
	"testing"

	"github.com/signadot/hotrod/pkg/log"
	"github.com/signadot/hotrod/pkg/tracing"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

func TestLocationClient(t *testing.T) {
	if os.Getenv("TEST_LOCATION_ADDR") == "" {
		t.Skip()
		return
	}
	ctx := context.Background()
	if key := os.Getenv("TEST_ROUTING_KEY"); key != "" {
		member, err := baggage.NewMember("sd-routing-key", key)
		if err != nil {
			t.Fatal(err)
		}
		bag, err := baggage.New(member)
		if err != nil {
			t.Fatal(err)
		}
		ctx = baggage.ContextWithBaggage(ctx, bag)
	}

	zapOptions := []zap.Option{
		zap.AddStacktrace(zapcore.FatalLevel),
		zap.AddCallerSkip(1),
		zap.IncreaseLevel(zap.LevelEnablerFunc(func(l zapcore.Level) bool { return l != zapcore.DebugLevel })),
	}
	logger, _ := zap.NewDevelopment(zapOptions...)
	zapLogger := logger.With(zap.String("service", "location"))
	l := log.NewFactory(zapLogger)

	// get a tracer provider for the frontend
	tracerProvider := tracing.InitOTEL("frontend", l)

	// get a location client
	locationClient := NewClient(tracerProvider, l, os.Getenv("TEST_LOCATION_ADDR"))
	locs, err := locationClient.List(ctx)
	if err != nil {
		t.Error(err)
		return
	}
	t.Logf("locations: %+v", locs)
}
