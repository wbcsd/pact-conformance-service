# Standalone CLI binaries (single-file executables built with `bun build --compile`).
#
# Each target generates a throwaway entrypoint that embeds the OpenAPI schema YAMLs
# (see scripts/gen-embed-entry.sh), compiles it, then removes it. NODE_ENV=production
# is defined at build time so the bundler eliminates the dev-only pino-pretty
# transport (which can't load in a single-file binary).

GEN     := packages/test/src/.cli-standalone.gen.ts
DEFINE  := --define 'process.env.NODE_ENV="production"'

.PHONY: build-linux build-mac clean

# x86_64 -> Linux, arm64 -> macOS (matches the conformance-test convention).
build-linux:
	./scripts/gen-embed-entry.sh
	bun build --compile $(DEFINE) --target=bun-linux-x86_64 $(GEN) --outfile pact_cli_x86_64
	rm -f $(GEN)

build-mac:
	./scripts/gen-embed-entry.sh
	bun build --compile $(DEFINE) --target=bun-darwin-arm64 $(GEN) --outfile pact_cli_arm64
	rm -f $(GEN)

clean:
	rm -f $(GEN) pact_cli_x86_64 pact_cli_arm64
