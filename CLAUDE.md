# jbrowse-plugin-msaview

An ES module plugin a JBrowse 5 host loads at runtime, code-split so a config
naming it evaluates only the registration. How the build meets the host, and the
checks that guard it: `agent-docs/host-compatibility.md`.

- **Read `meta.json` after touching an import on the registration path.** One
  value import at module scope from an eagerly loaded file puts its dependency
  back in the entry, and nothing in tsc, lint or the tests says so.
- **Grep jb2hubs' `website/src/components/proteinSession.ts` before renaming an
  `MsaView` model property.** Its links carry raw snapshots, MST drops an
  unknown key without a word, and the link opens on an empty import form.
  `test/sessionSnapshot.test.ts` covers the shapes it sends today.
- **Send every eutils request through `utils/eutils.ts`.** A burst over 3 a
  second comes back without `Access-Control-Allow-Origin` and reads as a CORS
  failure.
- **Probe the exact URL's CORS headers before relying on a remote service**;
  they differ per endpoint, even on one host (`agent-docs/remote-services.md`).
