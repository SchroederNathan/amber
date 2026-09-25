# Onboarding artwork

Generated PNGs with alpha, bundled locally; no remote image requests.

- `device-camera.png`: base front-facing graphite device with a neutral camera icon.
- `device-photos.png`: edit of the base, replacing only the center icon with photo cards.
- `device-biometrics.png`: edit of the base, replacing only the center icon with a face scan.

The permission stage intentionally crops the lower part of each phone, following the supplied full-screen permission reference. The three images share their frame and scale so only the icon changes between steps. Keep them mounted together to avoid decoding a new image during a transition.

Light onboarding uses Tailwind stone-50 / stone-900 with amber-900 actions and white labels. Dark onboarding uses stone-950 with amber-200 actions and amber-950 labels. Tokens are scoped to onboarding in `src/unistyles.ts`.
