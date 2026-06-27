protein3d passes colorSchemeName inside init, but colorSchemeName is a native
top-level MsaView property — MsaViewInitState has never included it, so
processInit has always dropped it. Its 'percent_identity' coloring has silently
never applied. The clean fix is in protein3d (move colorSchemeName out of init
to the top level of the snapshot). Want me to make that one-line fix in the
protein3d repo?
