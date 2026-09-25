## [3.10.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v3.9.0...v3.10.0) (2026-09-25)

### Bug Fixes

- Update react-msaview to 8.4.0, which no longer calls createFilterOptions ([8d00ef5](https://github.com/GMOD/jbrowse-plugin-msaview/commit/8d00ef526510e9aec656d51b4b59039437dd20c2))
- Map the CDS rows translation reads ([cca2fec](https://github.com/GMOD/jbrowse-plugin-msaview/commit/cca2fecd5a56594b0ecf6feac10c82fadbea9538))
- Update react-msaview to 8.4.1, whose Go to box renders on MUI 7 hosts ([bbaeed4](https://github.com/GMOD/jbrowse-plugin-msaview/commit/bbaeed4f34270290b7837d32cb64ce415ed703a8))

### Chores

- Check every bundled module's @mui/material imports, not just src's ([831bd37](https://github.com/GMOD/jbrowse-plugin-msaview/commit/831bd37dfff953efe8bd58765fce8151f4500247))
- Drop v3.7.0 support; the v4.3.0 leg covers the legacy context menu ([a7b6111](https://github.com/GMOD/jbrowse-plugin-msaview/commit/a7b611152bcc7e712e1619e00f580f9a26f6aaac))
- Bump @jbrowse/core and plugin-linear-genome-view to 5.0.0-beta.9 ([46605bf](https://github.com/GMOD/jbrowse-plugin-msaview/commit/46605bf59b3178006f64892c5176ec5b52c3244d))

### Documentation

- The floor, not the ReExports list, is what bundles a deep core path ([e184562](https://github.com/GMOD/jbrowse-plugin-msaview/commit/e1845626a1af056083d13db105027c5a7d969514))

### Other Changes

- Bump deps ([a33c354](https://github.com/GMOD/jbrowse-plugin-msaview/commit/a33c35461648f88984f09be39955eb7a039a0ca8))

### Refactoring

- Translate transcripts with core's translateTranscript ([a38e389](https://github.com/GMOD/jbrowse-plugin-msaview/commit/a38e3898b0ccb5d0be43bb31c572f340a9e584c8))

### Tests

- Read the e2e server port from JBROWSE_PORT, so two sessions' runs stop killing each other's server ([111ed37](https://github.com/GMOD/jbrowse-plugin-msaview/commit/111ed375048693e205ff7df8cfe9463c3c3eb8e9))
- Fail the transcript e2e when the MSA view shows an error instead of its header ([97d9c19](https://github.com/GMOD/jbrowse-plugin-msaview/commit/97d9c199576d89092f8f728e3e1c6c26bf398549))
- Recapture the v4.3.0 final screenshot with the Go to box ([42f61c1](https://github.com/GMOD/jbrowse-plugin-msaview/commit/42f61c1db1c19d669eee5647f1a158858a8412c4))

## [3.9.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v3.8.0...v3.9.0) (2026-09-24)

### Bug Fixes

- A cancel or closed dialog aborts the NCBI and PANTHER lookups in flight ([6d9821d](https://github.com/GMOD/jbrowse-plugin-msaview/commit/6d9821db29220bb27ca9c5309d3875373f0bf464))
- The in-browser aligner refuses an alignment too big to run on the page ([208957e](https://github.com/GMOD/jbrowse-plugin-msaview/commit/208957efcd3e86deed2888856389aa2831ab19ba))
- A malformed linked transcript unlinks the view instead of throwing ([2dba656](https://github.com/GMOD/jbrowse-plugin-msaview/commit/2dba65644a4c4191467997780038a2a44d99c8cc))
- A BLAST search survives an alignment that refuses or fails ([321d0f4](https://github.com/GMOD/jbrowse-plugin-msaview/commit/321d0f4c1f7819906c924737b99414674bd2df52))
- A cancelled taxonomy lookup keeps the names it fetched, and frees its eutils slot ([ab129e8](https://github.com/GMOD/jbrowse-plugin-msaview/commit/ab129e8089eb8010274b0090ae043718bb32df59))
- Saved BLAST hits expire after seven days, so a later relaunch searches afresh ([3db42da](https://github.com/GMOD/jbrowse-plugin-msaview/commit/3db42da58a0c14e6d786d78d9b8d9638991675b6))
- Highlight codons from every MSA view linked to a genome view ([069ce48](https://github.com/GMOD/jbrowse-plugin-msaview/commit/069ce488648427401208668e502564e770bc96c5))
- Keep in IndexedDB exactly what a reload would lose ([6e6008c](https://github.com/GMOD/jbrowse-plugin-msaview/commit/6e6008c142c11ff629ca965d7b4c09370868f671))
- Never write or delete a stored row another view may share ([443aae4](https://github.com/GMOD/jbrowse-plugin-msaview/commit/443aae497d030f1242497411d2ebf537d74e2174))
- Reset drops the stored id instead of deleting the row ([815a9fe](https://github.com/GMOD/jbrowse-plugin-msaview/commit/815a9febb05cbcb3f5fce8b31c6e233f7e4832d3))

### Documentation

- Note translateTranscript waits on a core release ([ebe3a9c](https://github.com/GMOD/jbrowse-plugin-msaview/commit/ebe3a9c849277dc620e4b5695445537a2218ee4f))
- Drop the finished robustness items from the todo list ([543002c](https://github.com/GMOD/jbrowse-plugin-msaview/commit/543002ca2ec9f0c356cc9ecb7303e37e37508036))

### Refactoring

- One runEbiJob drives every EBI Job Dispatcher run ([03a80d7](https://github.com/GMOD/jbrowse-plugin-msaview/commit/03a80d72f131e8a00937a7096ebc17e6ff2561a2))
- Drop exports nothing imports, and the unused SeqState type ([24c0f3f](https://github.com/GMOD/jbrowse-plugin-msaview/commit/24c0f3f6b2bd6bf9f50d427f71f0cc80121884c1))

### Styling

- Drop the new doc comments, and the non-null assertions in transcriptMap's tests ([b2a8b78](https://github.com/GMOD/jbrowse-plugin-msaview/commit/b2a8b789573bd632d1878b3ee20616af95acf476))

## [3.8.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v3.7.1...v3.8.0) (2026-09-22)

### Bug Fixes

- Open the transcript picker on the isoform a canvas click landed on ([e4f044d](https://github.com/GMOD/jbrowse-plugin-msaview/commit/e4f044db4ab30fe89b131b6fa39c0ecc8243bb66))

### Documentation

- The canvas context-menu API is JBrowse 5, not 4.3 ([bc72bfd](https://github.com/GMOD/jbrowse-plugin-msaview/commit/bc72bfd68576421d66052553d88004c06411c895))

### Refactoring

- Drop setMafRegion and setQuerySeqOffset, which nothing calls ([c659bef](https://github.com/GMOD/jbrowse-plugin-msaview/commit/c659bef9474e1e97af369e81789e34794f8d1c40))

## [3.7.1](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v3.7.0...v3.7.1) (2026-09-18)

### Chores

- React-msaview and msa-parsers 8.2.0, which carry expandSpec ([4af193b](https://github.com/GMOD/jbrowse-plugin-msaview/commit/4af193b64aded201c7dca22c6c6b514d436c62c8))

### Documentation

- Capture the README figure from the demo link at every release ([22cc49f](https://github.com/GMOD/jbrowse-plugin-msaview/commit/22cc49f404d17456b380d0cb801ced7ea2d1026d))
- Drop the ClinVar track from the demo's genome view ([6bda0cf](https://github.com/GMOD/jbrowse-plugin-msaview/commit/6bda0cf3c5c18ab40116574fad4f242fcb2ae1c6))
- README as a portal; split DEVELOPERS.md into launching, parameters, alignments from a gene and linked views; add a guide for your own alignments ([4325447](https://github.com/GMOD/jbrowse-plugin-msaview/commit/432544703737bd4bbd900780b3fab4e9c03e351d))

### Features

- Session specs take react-msaview's short forms, and the demo link uses them ([65754d9](https://github.com/GMOD/jbrowse-plugin-msaview/commit/65754d975d04feb28a1f534cbfcd283e84b829e3))

## [3.7.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v3.6.0...v3.7.0) (2026-09-18)

### Bug Fixes

- Translate with the genetic code's initiators and transl_except, as core's feature panel does ([62808f9](https://github.com/GMOD/jbrowse-plugin-msaview/commit/62808f960035d8f61d152152c55aa3c1efcdc346))
- Keep one query residue per codon, so a partial first codon no longer shifts the genome link ([6f99a3d](https://github.com/GMOD/jbrowse-plugin-msaview/commit/6f99a3d3bd90a2da7d6156a762e18dbe2275c1bd))
- Validate the remembered ortholog source before the Orthologs tab indexes by it ([b4d7330](https://github.com/GMOD/jbrowse-plugin-msaview/commit/b4d73303ca78733ff97acccf86bc357d15817455))
- A launch replaces the one holding the controller instead of orphaning it ([b17defd](https://github.com/GMOD/jbrowse-plugin-msaview/commit/b17defdbb109d5c87e775e1d519f767bc22cbb48))
- The connectedTranscript lookup retries, searches feature tracks on screen first, and lets only the latest lookup write ([171b1aa](https://github.com/GMOD/jbrowse-plugin-msaview/commit/171b1aa32b7a2f4a84fde95a01ba16c7e8ffde0f))
- A collapsed query row still maps, and a MAF hover past the row's end lights nothing ([62dbfa6](https://github.com/GMOD/jbrowse-plugin-msaview/commit/62dbfa6a3451d3c0a56484fd29d93192847d4fc6))
- Keep a view's GFF in IndexedDB alongside its alignment ([9fc19cd](https://github.com/GMOD/jbrowse-plugin-msaview/commit/9fc19cd9560493eda09521117b02de1088fe339a))
- An IndexedDB open blocked by another tab rejects instead of hanging the launch ([ad650fd](https://github.com/GMOD/jbrowse-plugin-msaview/commit/ad650fd53dee9b85ad15b2588ee68cdb39c84d8e))
- A cache the browser refuses no longer fails a finished search ([28ec22f](https://github.com/GMOD/jbrowse-plugin-msaview/commit/28ec22f1f42a21566bf60a9e3a12ab6f0a8d601c))
- A UniProt isoform accession launches that isoform, not the canonical sequence ([20e3232](https://github.com/GMOD/jbrowse-plugin-msaview/commit/20e3232a66efb3d92024c3ec42f334f1f6145c29))
- The EBI poll rides out a long outage instead of quitting after 50 seconds ([c6bc2d3](https://github.com/GMOD/jbrowse-plugin-msaview/commit/c6bc2d3929545f61f2c6adcd3ad010b6f869c9cb))
- BLAST history keeps runs with different hit counts apart and names the aligner that ran ([97d93dc](https://github.com/GMOD/jbrowse-plugin-msaview/commit/97d93dc9dc8215e958f7e664b9dbc08aa59cfe12))
- Eutils requests go out spaced under NCBI's rate limit, and their XML escapes are decoded ([5194493](https://github.com/GMOD/jbrowse-plugin-msaview/commit/51944939d5717ebaee0a57350523296c89fc4ae1))
- A failing Add-menu contribution no longer takes the app down ([9e20c66](https://github.com/GMOD/jbrowse-plugin-msaview/commit/9e20c66b405bcce2aa4c293d2b2d41f23e2ac183))

### Chores

- Delete the unused ucsc/ species table and its lint and ignore entries ([a6dce58](https://github.com/GMOD/jbrowse-plugin-msaview/commit/a6dce58b38ea371b35493b00bb47d2f03378c517))

### Documentation

- A p53 demo linking genome, alignment and structure, and drop the removed structure-connection docs ([96d86d0](https://github.com/GMOD/jbrowse-plugin-msaview/commit/96d86d0ce9548baa6ce76035ea350977fd2612f0))

### Features

- A `region` spec key opens the view zoomed onto a residue range ([4f17a6e](https://github.com/GMOD/jbrowse-plugin-msaview/commit/4f17a6e2d9176d36266b10f6fc4c1beecedaf513))

### Other Changes

- Update deps ([fe33e4c](https://github.com/GMOD/jbrowse-plugin-msaview/commit/fe33e4cf949bfc362c11bdfc5640a21d0125e3ec))
- Some todos ([cc0bd90](https://github.com/GMOD/jbrowse-plugin-msaview/commit/cc0bd9003ac0c3a6d0e4c7246da88da26676df01))

### Refactoring

- One launch helper for the dialog, handed its placement rather than reading it back from storage ([3f33c8a](https://github.com/GMOD/jbrowse-plugin-msaview/commit/3f33c8ad00b49f25eb6f2f58230c8fa0146128c7))

## [3.6.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v3.5.0...v3.6.0) (2026-09-16)

### Bug Fixes

- Keep a visited launch tab mounted so it does not lose its state ([fa28d0e](https://github.com/GMOD/jbrowse-plugin-msaview/commit/fa28d0e9628c0d2cb6aa1c7a12223c1302329903))
- Canonicalize the refName on both sides of a genome hover ([1af58b5](https://github.com/GMOD/jbrowse-plugin-msaview/commit/1af58b504e90a84ac92ee9df41fa64a94762b26f))
- Translate with the assembly's genetic code, and stop taking dedupe off the barrel ([d75a0b4](https://github.com/GMOD/jbrowse-plugin-msaview/commit/d75a0b4229fee3dd4638766311bf3efeb4b23a03))
- Write the placement choice on submit, not on the click ([aa9d078](https://github.com/GMOD/jbrowse-plugin-msaview/commit/aa9d07846bf5f9401645a7eedb479d6e346d5ce3))
- Offer the MSA launch only for features that code for a protein ([c2ed15b](https://github.com/GMOD/jbrowse-plugin-msaview/commit/c2ed15b5bfc675acd095c684ab9eaa1bac29d300))
- Let an expired alignment run its own search again ([0ad884b](https://github.com/GMOD/jbrowse-plugin-msaview/commit/0ad884bdc4d2ab193cbfd87d5645da5672a12212))
- Find the pre-loaded dataset's query row by sequence ([166926e](https://github.com/GMOD/jbrowse-plugin-msaview/commit/166926e35d9ecf82798fb5c88b17eece1b532c00))
- An indexed view's alignment is in the link, so stop warning that it is not ([b388690](https://github.com/GMOD/jbrowse-plugin-msaview/commit/b3886905269d276d60de247c808895eba34ec9ec))
- Do not ask an assembly for aliases it has not loaded ([f8248b1](https://github.com/GMOD/jbrowse-plugin-msaview/commit/f8248b1861fa2c9ee7795998dd41bc649c39bf22))
- Refuse a pre-loaded launch with no query row, and keep the old name as a fallback ([f9f96cb](https://github.com/GMOD/jbrowse-plugin-msaview/commit/f9f96cbf2479141360c2844702eaf8594b0660b8))
- One placement answer per dialog, not per tab ([8b6d022](https://github.com/GMOD/jbrowse-plugin-msaview/commit/8b6d022554d9367768de2e147c6e1af20ddf92bb))
- An absent subfeature list is not an answer about coding ([65e36c8](https://github.com/GMOD/jbrowse-plugin-msaview/commit/65e36c8231d26bd2a44959fefed273563543a563))
- Keep the clicked isoform selected when the dialog opens on its gene ([9b980b2](https://github.com/GMOD/jbrowse-plugin-msaview/commit/9b980b28792f6158337513ca7fea5a9d62d5d6ba))
- The hostRestoresData override dropped the base answer ([7311d91](https://github.com/GMOD/jbrowse-plugin-msaview/commit/7311d9122f8df824d2b146a41db60b5be5c0500e))

### Chores

- Read core 5's unwrapped MUI re-exports in check-mui-imports ([b0af125](https://github.com/GMOD/jbrowse-plugin-msaview/commit/b0af125aa8b05dda597d6c93ebaa34ea3b1c5644))
- Build against @jbrowse/core 5.0.0-beta.8, keeping the calls v4 hosts need ([c5976da](https://github.com/GMOD/jbrowse-plugin-msaview/commit/c5976da95525c1ff4c2de8bfb77402591bb5f09d))
- React-msaview 8, msa-parsers 8, and the routine dep bumps ([734babc](https://github.com/GMOD/jbrowse-plugin-msaview/commit/734babc8baea8eb3352e01c833fa42945a93f586))

### Features

- Say why Submit is grey while the query sequence loads ([c72661d](https://github.com/GMOD/jbrowse-plugin-msaview/commit/c72661d73fbb14bb2e4ab434a9a7100752dadd4f))
- Name things the way a reader would, and put the prose behind Help ([f353de2](https://github.com/GMOD/jbrowse-plugin-msaview/commit/f353de282a521acee18ac94d54b0369c87d4c03b))

### Refactoring

- Mark a launch done rather than copying its request ([d315be9](https://github.com/GMOD/jbrowse-plugin-msaview/commit/d315be95eb1bf75d6a9c994919886192d6e5428c))
- Translate with core's geneticCodes rather than a vendored copy ([0642391](https://github.com/GMOD/jbrowse-plugin-msaview/commit/0642391fc08e76da689117f8d16571595a67d843))

### Styling

- Satisfy oxlint on the tab panel and the hover-sync stubs ([7a49f12](https://github.com/GMOD/jbrowse-plugin-msaview/commit/7a49f12a298d4ee9778dee23ebc3af69e230024c))

### Tests

- Give the hover-sync stub an assemblyManager ([d088eb2](https://github.com/GMOD/jbrowse-plugin-msaview/commit/d088eb27a3ff26afa7fe2ba47f80299ee52632e9))
- Find Submit inside the visible tab panel ([859f38b](https://github.com/GMOD/jbrowse-plugin-msaview/commit/859f38b185b01e2f4e6a585d920999f97e60ad75))
- Refresh the context-menu capture, which had no plugin row in it ([74d1af5](https://github.com/GMOD/jbrowse-plugin-msaview/commit/74d1af59f9b39d72b97cec30be4fb55f1d8d6968))
- Refresh the v4.3.0 reference for react-msaview 8's cosmetics ([063b15c](https://github.com/GMOD/jbrowse-plugin-msaview/commit/063b15c35fc91a560584a9d202f70bfc123a4c53))

## [3.5.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v3.4.1...v3.5.0) (2026-09-14)

### Bug Fixes

- Map the column the user clicked, not the one under it ([7c98cb7](https://github.com/GMOD/jbrowse-plugin-msaview/commit/7c98cb7004f73b2be05b8400c45ad1a32cb70b18))
- Put the zoom-to-base-level toggle where the hamburger looks ([59dd164](https://github.com/GMOD/jbrowse-plugin-msaview/commit/59dd164dc8dccb48fada42ed36f9d98bbb554c63))
- Map a trimmed query row through its offset ([7ffaf2c](https://github.com/GMOD/jbrowse-plugin-msaview/commit/7ffaf2c482bdb0be8c5a4fe53691b67cb86a93d6))
- Store the launch transcript as JSON, not as a Feature ([4d84d39](https://github.com/GMOD/jbrowse-plugin-msaview/commit/4d84d39560eb968514366a71edd7019859174781))
- Keep the init an indexed alignment is the only record of ([91e3b9c](https://github.com/GMOD/jbrowse-plugin-msaview/commit/91e3b9c942bdd3895c6820f7d91043c6e7c2a468))
- Make reset keep the view and drop the file ([f4c79ee](https://github.com/GMOD/jbrowse-plugin-msaview/commit/f4c79eee7dab25a1580dd5c961a1fb930095d8ad))
- Don't lose a finished alignment to the tree step ([a7af43c](https://github.com/GMOD/jbrowse-plugin-msaview/commit/a7af43c13863aa35d899604566312cfa24602fbb))

### Chores

- Push HEAD and wait for Integration rather than refusing it ([4b4dff0](https://github.com/GMOD/jbrowse-plugin-msaview/commit/4b4dff018c09a71b4e5d455d70e1471673e79e08))
- Externalize only what the oldest supported host also re-exports ([ffc2a4e](https://github.com/GMOD/jbrowse-plugin-msaview/commit/ffc2a4e3f894dac0a1588aba591543a805834507))
- Sort the floor list through a comparator ([3e02cca](https://github.com/GMOD/jbrowse-plugin-msaview/commit/3e02cca7e3d8978a5d94a82e396e619489caffa0))
- Take react-msaview 7.0.0, and run the test build with pnpm ([beb0873](https://github.com/GMOD/jbrowse-plugin-msaview/commit/beb0873ba2d45cdeb1366696d79c0ea2c6d1bc30))

### Features

- Homologs without a job, and searches from a URL ([a2dce0d](https://github.com/GMOD/jbrowse-plugin-msaview/commit/a2dce0d8b8a0d751f1690938ac8299c0a068a504))
- Retry or dismiss a failed launch ([bf69a5e](https://github.com/GMOD/jbrowse-plugin-msaview/commit/bf69a5ee1306f36bc7a29f9e24e99d7c5d7a8717))

### Other Changes

- Update deps ([258a167](https://github.com/GMOD/jbrowse-plugin-msaview/commit/258a16737b9c22b36906a2c481dd1cc9f8979ba7))

### Refactoring

- Hand CDD annotations over as annotations ([32c66d0](https://github.com/GMOD/jbrowse-plugin-msaview/commit/32c66d0a3cc4ab3a6647ba1575a32b92cbca53c5))

## [3.4.1](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v3.4.0...v3.4.1) (2026-09-05)

### Bug Fixes

- Keep dedupeLabels from reusing a suffix a raw name already holds ([6070cc5](https://github.com/GMOD/jbrowse-plugin-msaview/commit/6070cc5e4985dbc03b561242bd8fafc56f92d317))
- Omit init when the spec named nothing for it to resolve ([13e1e24](https://github.com/GMOD/jbrowse-plugin-msaview/commit/13e1e24677b513f2c93a8e08ca08469083c0b26b))
- Cap the BLAST result cache at 50 entries ([bdb6182](https://github.com/GMOD/jbrowse-plugin-msaview/commit/bdb6182ea22b553473df103c5001b846f292a83c))
- Keep IndexedDB in step with the view, and say when a row is gone ([fbdc269](https://github.com/GMOD/jbrowse-plugin-msaview/commit/fbdc26923c39bb802d1d133879624c3cc42a0046))
- Release each sleep's abort listener when it resolves ([27712e4](https://github.com/GMOD/jbrowse-plugin-msaview/commit/27712e4128a10c4652f733bac99d174158c4029b))
- Satisfy core@main's store-manifest SRI in the host-compat probe ([9803d06](https://github.com/GMOD/jbrowse-plugin-msaview/commit/9803d06d4b6150773a8e3d350b523cdb1d65aa33))

### Chores

- Run Integration on branches, not on the tag that repeats them ([27f0e96](https://github.com/GMOD/jbrowse-plugin-msaview/commit/27f0e96f297f62b45aa005c48e6295d00169d3fb))
- Name the branches Integration runs on, since ignoring tags alone matched nothing ([ec4f181](https://github.com/GMOD/jbrowse-plugin-msaview/commit/ec4f181ff031c26d43caf050db266d8fa314ae5d))

### Documentation

- Restore the v3.4.0 docs line that git-cliff truncated ([8c9a60f](https://github.com/GMOD/jbrowse-plugin-msaview/commit/8c9a60f0dd261212ece6f9b9f4e98e9eba6ba144))

### Features

- Reopen the panel on the last search program, database and aligner ([932ae93](https://github.com/GMOD/jbrowse-plugin-msaview/commit/932ae93f03b97e81f99ccbbb86c94e585ba2603d))
- Share the remembered aligner with the BLAST tab ([cf17337](https://github.com/GMOD/jbrowse-plugin-msaview/commit/cf1733754fd9ea11f4989dee5857f4199ee0aa96))
- Thread an abort signal through the EBI job pipeline ([fc951b5](https://github.com/GMOD/jbrowse-plugin-msaview/commit/fc951b5d7dfbb32069d9d0f456aaf5867028e15e))
- Tie a launch to the view, and let the user cancel one ([fed56eb](https://github.com/GMOD/jbrowse-plugin-msaview/commit/fed56ebeda1332e39c171b85b886c27b38f35deb))
- Take react-msaview 6.3.0's highlights and columnTracks in a session spec ([eeec2ce](https://github.com/GMOD/jbrowse-plugin-msaview/commit/eeec2ce07f2f993e02f59688470f218c9dfea8c5))

### Other Changes

- Updates ([d5ae347](https://github.com/GMOD/jbrowse-plugin-msaview/commit/d5ae347563fddbee46cab42b8b8dab41cd3bfad5))
- Bump react-msaview ([0b5d028](https://github.com/GMOD/jbrowse-plugin-msaview/commit/0b5d02895e8bc47d188b9fff2ccff71beea769df))

### Refactoring

- One gene-candidate cleaner for both NCBI and PANTHER ([d1b8b2a](https://github.com/GMOD/jbrowse-plugin-msaview/commit/d1b8b2ae8e39b915186a8befcab3c6f76e57b886))
- GetSequenceByRowName reuses getRowByName ([f274fb3](https://github.com/GMOD/jbrowse-plugin-msaview/commit/f274fb3eb9323adbfd9c44573803f132bc672660))

## [3.4.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v3.3.0...v3.4.0) (2026-08-26)

### Bug Fixes

- Show progress and errors for an ortholog launch, not just BLAST ([32471f8](https://github.com/GMOD/jbrowse-plugin-msaview/commit/32471f8bc2b94bbaaa2c1ac1c867e9fb23575a87))
- A query row the alignment does not have maps to nothing, not column 0 ([2e4d6df](https://github.com/GMOD/jbrowse-plugin-msaview/commit/2e4d6df5f3a6d4ec27f3026f57c2e849659ddc56))
- A cached phmmer result no longer lists its aligner as "(undefined)" ([e816bde](https://github.com/GMOD/jbrowse-plugin-msaview/commit/e816bdeec3ce86cab71a493a21fced6c78b919e4))
- Widen the database field so its value is readable ([59b8492](https://github.com/GMOD/jbrowse-plugin-msaview/commit/59b8492272f73fd51a7624f7569fefe854340129))

### Chores

- Guard the deps the host supplies, and the typescript eslint can load ([8484ad6](https://github.com/GMOD/jbrowse-plugin-msaview/commit/8484ad63c4b6d41108f75ba0b13002f19c241362))
- Replace eslint and prettier with oxlint and oxfmt ([e2de8bf](https://github.com/GMOD/jbrowse-plugin-msaview/commit/e2de8bfc38af19eeb2f79a4f0dd02f0996ba2ec1))
- Format the captured metadata fixture ([cb6e7dd](https://github.com/GMOD/jbrowse-plugin-msaview/commit/cb6e7dd3261a0053380d91883cd16c2fb88c4940))
- Check phmmer's databases and the tree tool against EBI too ([6fd6b86](https://github.com/GMOD/jbrowse-plugin-msaview/commit/6fd6b86d9f4f1fb5daef02ab3e57f1cc8dcdc8bc))
- Drop defaultSearchProgram, which nothing reads ([290e3e1](https://github.com/GMOD/jbrowse-plugin-msaview/commit/290e3e150d68642a789c4dc095a1cbe259f14496))

### Documentation

- The phmmer query row must throw, and a real change can hide under the screenshot tolerance ([736bc67](https://github.com/GMOD/jbrowse-plugin-msaview/commit/736bc674a57249c23086953330c83cfbb2d48974))

### Features

- Add phmmer as a search program, and use its alignment as-is ([c36882d](https://github.com/GMOD/jbrowse-plugin-msaview/commit/c36882d935e55eed832f9a39d09ec3af82ef14e3))

### Performance Improvements

- Ask NCBI and EBI once for what they were asked twice for ([f15bdc7](https://github.com/GMOD/jbrowse-plugin-msaview/commit/f15bdc70a361000a5127b9bef67df58ca2a634b9))

### Refactoring

- Parse a pasted alignment once per keystroke, not twice ([4bde79a](https://github.com/GMOD/jbrowse-plugin-msaview/commit/4bde79a6d41f187436071547323adfa1ea6e5cc1))
- Let the program decide the database's type, not a cast ([54579d5](https://github.com/GMOD/jbrowse-plugin-msaview/commit/54579d5104694136ebbed038e74ce0662ea03672))

### Tests

- Check the pipeline end to end against EBI, and measure it ([3db0b5b](https://github.com/GMOD/jbrowse-plugin-msaview/commit/3db0b5b9918abd8f640ea465089376579f336fdf))
- Screenshot the rendered alignment and the launch dialog ([65088e4](https://github.com/GMOD/jbrowse-plugin-msaview/commit/65088e435239f6cf770e11b606818ed93434c3fd))
- Cover the row naming without needing the network ([7446339](https://github.com/GMOD/jbrowse-plugin-msaview/commit/7446339f737c3f2e2ca483fd0ca922894ac7a316))
- Recapture the references against the rebased panel ([eab3a34](https://github.com/GMOD/jbrowse-plugin-msaview/commit/eab3a349234ce10c8de8bbf63f1e5adba6b1c2ca))

## [3.3.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v3.2.0...v3.3.0) (2026-08-25)

### Documentation

- Every matrix leg runs the whole suite, so tests feature-detect too ([7d2bf39](https://github.com/GMOD/jbrowse-plugin-msaview/commit/7d2bf3966a84b3a3b5e8abf0a359ea075f9fb424))
- The source key, and what the CDD overlay does with UniProt accessions ([b735837](https://github.com/GMOD/jbrowse-plugin-msaview/commit/b735837faa5321ba916631e606a3ed8cad77cd6b))
- Two live ortholog sources is the ceiling, new coverage is build-time data ([3aabcd3](https://github.com/GMOD/jbrowse-plugin-msaview/commit/3aabcd36af22889b37bb0b1039ea20ac9ee9b3cb))

### Features

- PANTHER as a second source, for the species NCBI's sets leave out ([380b512](https://github.com/GMOD/jbrowse-plugin-msaview/commit/380b5127c303b282bf0f686929b98f6642b59ffd))

### Tests

- Refresh the launch-dialog references for the Source select ([c4c94ce](https://github.com/GMOD/jbrowse-plugin-msaview/commit/c4c94ce700d9645c80e99a02ea7ff83a89e715ec))

## [3.2.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v3.1.0...v3.2.0) (2026-08-25)

### Bug Fixes

- Stop the placement checkbox squeezing the dialog's buttons ([fb00406](https://github.com/GMOD/jbrowse-plugin-msaview/commit/fb0040641d37c4eaf5fd67310ce18de0e96dbb5b))

### Documentation

- The placement key, and the spec that puts an alignment beside its genome ([0658e24](https://github.com/GMOD/jbrowse-plugin-msaview/commit/0658e24e503709af312c71a6a78d14bd8cbcfc3e))

### Features

- Say where a launched MSA view goes, instead of always stacking it ([92fa38a](https://github.com/GMOD/jbrowse-plugin-msaview/commit/92fa38a3f7233fad2e3bd4f0061af2445286d707))

### Tests

- Prove the split on a real host, not just on a stub session ([91bedc6](https://github.com/GMOD/jbrowse-plugin-msaview/commit/91bedc63a81d1771d81ac83d43919e6620604d6c))
- Cover the placement checkbox, in the two places it can be covered ([a0637e7](https://github.com/GMOD/jbrowse-plugin-msaview/commit/a0637e7f41232b2fb099d64f638820cf6324346c))
- The placement spec test has to survive hosts that cannot tile ([67617ad](https://github.com/GMOD/jbrowse-plugin-msaview/commit/67617ad54cd4a19172fdc970defe1d63a546d8cb))

## [3.1.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v3.0.0...v3.1.0) (2026-08-19)

### Bug Fixes

- Swap the dead uniprotkb_reference_proteomes option for pan_proteomes ([42b624c](https://github.com/GMOD/jbrowse-plugin-msaview/commit/42b624c6336fea8bb8d62b989060ded3cd1a34ab))

### Chores

- Check the panel's databases and tools against EBI's own lists ([300f948](https://github.com/GMOD/jbrowse-plugin-msaview/commit/300f948afd194bef0c7b391bbd589fdd28c8fb5b))

### Features

- Mirror the clicked domain onto the alignment, not just the hover ([b8d0d3e](https://github.com/GMOD/jbrowse-plugin-msaview/commit/b8d0d3e39efdef221d54ca4a63cb73b8d89efd5c))
- Finish the manual BLAST round trip in the panel, and find the query row by sequence ([fb8f049](https://github.com/GMOD/jbrowse-plugin-msaview/commit/fb8f049672f5fbc46a08da6ea16b0aff0e66e329))

### Refactoring

- Say why the click channel is skipped mid-hover, unpick sameColumns ([1ff441b](https://github.com/GMOD/jbrowse-plugin-msaview/commit/1ff441b28f8883bc53a850fc723f4e03491641e3))

### Tests

- Recapture the v4.3.0 references for the new row selector ([0e11523](https://github.com/GMOD/jbrowse-plugin-msaview/commit/0e1152371f33112fb1857fc32231f593835ecf6a))

## [3.0.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.10.2...v3.0.0) (2026-08-18)

### Features

- **BREAKING** React-msaview 6.0.0 (#60) ([c43a060](https://github.com/GMOD/jbrowse-plugin-msaview/commit/c43a060503a95875bccd4c159b84b2809786fe6d))

## [2.10.2](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.10.1...v2.10.2) (2026-08-17)

### Bug Fixes

- Write the key separator as an escape, not a raw NUL byte ([cb705d6](https://github.com/GMOD/jbrowse-plugin-msaview/commit/cb705d631c05b75fdb2a0578ae07fd941c65b1c3))

### Chores

- Fail on the two things 2.10.1 shipped that nothing was watching ([632e654](https://github.com/GMOD/jbrowse-plugin-msaview/commit/632e654120bc5923e5e6c76465a0f79333c856d4))
- Generate the changelog with git-cliff, release from the tag ([bed4b8d](https://github.com/GMOD/jbrowse-plugin-msaview/commit/bed4b8d0ee5e6db36db63b72f687e1787476f095))

### Documentation

- Backfill every release, in git-cliff's heading shape ([cafe4a4](https://github.com/GMOD/jbrowse-plugin-msaview/commit/cafe4a42f3992adbb1e4613e26350619119bfaca))

### Tests

- Recapture the five dialog references after the throttle fix ([fc45237](https://github.com/GMOD/jbrowse-plugin-msaview/commit/fc45237b7b0d2b608d6a4064334620516d1127b9))
- Recapture the v4.3.0 dialog references after the throttle fix ([5c011c1](https://github.com/GMOD/jbrowse-plugin-msaview/commit/5c011c1e3c58172626e950d653fea970da803777))
- Keep committed references only for the gated hosts ([763a0e3](https://github.com/GMOD/jbrowse-plugin-msaview/commit/763a0e3ebd65d24bba6cd4eb47bc806b835a4ee1))

## [2.10.1](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.10.0...v2.10.1) (2026-08-17)

- Take the query species from the assembly instead of assuming human
- Do one eutils lookup for the query species rather than four, which the
  throttled endpoint reported as a CORS failure
- Replace swr with a vendored useFetch
- Call the display's super contextMenuItems with a receiver, so Launch MSA view
  works on both host shapes
- react-msaview and msa-parsers 5.10.0

## [2.10.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.9.0...v2.10.0) (2026-08-17)

- Align every species NCBI has an ortholog for, rather than a fixed list of 23
- Name the query row for its species
- Keep polling an EBI job through a transient status-check failure
- Gate Launch MSA view on the clicked item, not the host's getter
- react-msaview and msa-parsers 5.7.3

## [2.9.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.8.2...v2.9.0) (2026-08-11)

- Run BLAST searches on EBI's Job Dispatcher. The direct NCBI query path is gone
  entirely: Blast.cgi sends no `Access-Control-Allow-Origin` to third-party
  origins, so no browser can read it. Reaching `nr` now means the Manual panel,
  which links out to NCBI
- Let a deployment set its own contact email for EBI
- Share the Job Dispatcher transport between the MSA and BLAST paths
- Say what a "Failed to fetch" actually means

## [2.8.2](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.8.1...v2.8.2) (2026-08-09)

- Build an ortholog alignment from a session spec, not only from the dialog

## [2.8.1](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.8.0...v2.8.1) (2026-08-09)

- react-msaview 5.7.2, for the gappyness slider's testid

## [2.8.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.7.4...v2.8.0) (2026-08-09)

- Ten more species in the orthologs dialog, in less vertical space

## [2.7.4](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.7.3...v2.7.4) (2026-08-06)

- Build the MSA from NCBI orthologs instead of a BLAST search
- react-msaview and msa-parsers 5.7.1

## [2.7.3](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.7.2...v2.7.3) (2026-08-06)

- Correct the genome<->MSA coordinate conversions in both directions
- Type the IndexedDB stores and scope the cache clear
- react-msaview 5.7.0

## [2.7.2](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.7.1...v2.7.2) (2026-08-01)

- Restore the pre-4.3 context menu path, and stop importing `useLocalStorage`,
  which `@jbrowse/core/util` no longer exports on nightly
- Stop translating through the host's codon table
- Refuse to tag a release when Integration is red on HEAD

## [2.7.1](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.7.0...v2.7.1) (2026-07-30)

- Boot on released JBrowse hosts again: bundle `@mui/material/SvgIcon` rather
  than resolving it from the host, whose exported shape varies by MUI major

## [2.7.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.6.8...v2.7.0) (2026-07-24)

- Adapt Launch MSA view to the canvas-based LinearBasicDisplay
- Notify instead of silently failing when an MSA feature can't load
- Drop the legacy contextMenuFeature fallback

## [2.6.8](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.6.7...v2.6.8) (2026-07-04)

- Simplify the MSA launch flow, and reconnect cached BLAST results to the genome

## [2.6.7](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.6.6...v2.6.7) (2026-07-04)

- Fix cache bugs, drop dead code, memoize IndexedDB connections

## [2.6.6](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.6.5...v2.6.6) (2026-07-02)

- Keep the MSA click-selection genome band visible while hovering the LGV

## [2.6.5](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.6.4...v2.6.5) (2026-06-28)

- react-msaview and msa-parsers 5.5.0

## [2.6.4](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.6.3...v2.6.4) (2026-06-27)

- Drop the legacy MSA-driven structure-highlight path

## [2.6.3](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.6.2...v2.6.3) (2026-06-27)

- Connect a genome-linked MSA to its 3D structure without requiring a UniProt id
- Narrow the launch extension point to sources resolved at launch time

## [2.6.2](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.6.1...v2.6.2) (2026-06-27)

- Simplify the launch extension point init

## [2.6.1](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.6.0...v2.6.1) (2026-06-27)

- Replace the tabix-by-locus MSA launch with a name-indexed bgzip read

## [2.6.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.5.2...v2.6.0) (2026-06-27)

- Launch an alignment from a locus-keyed tabix file (msaTabixLocation + msaId)

## [2.5.2](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.5.1...v2.5.2) (2026-06-27)

- Fix observeProteinHighlights wiping the declarative highlightColumns seed

## [2.5.1](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.5.0...v2.5.1) (2026-06-26)

- Overlay NCBI CDD protein domain and site annotations on the alignment
- Support declarative highlightColumns
- react-msaview 5.4.1

## [2.5.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.4.5...v2.5.0) (2026-05-29)

- Fix the BLAST/MSA polling delay and CDS matching, and wire genome hover to the
  MSA highlight

## [2.4.5](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.4.4...v2.4.5) (2026-05-28)

- Fix the isoform combobox lookup for MUI 7's div-based InputLabel
- Simplify the highlight sync derived state
- Stop shipping source maps

## [2.4.4](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.4.3...v2.4.4) (2026-05-21)

- Dependency bumps

## [2.4.3](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.4.2...v2.4.3) (2026-05-21)

- Share scaffolding between the MSA launch panels

## [2.4.2](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.4.1...v2.4.2) (2026-05-21)

- Re-release

## [2.4.1](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.4.0...v2.4.1) (2026-05-21)

- Re-release

## [2.4.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.3.8...v2.4.0) (2026-05-14)

- Suppress the codon highlight in the LGV during genome hover
- Tighten BLAST types and dialog SWR keys, fixing silent bugs
- Batch taxonomy cache reads and trim dead code
- Remove the Ensembl gene tree panel
- Restore the version-based release pipeline

## [2.3.8](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.3.7...v2.3.8) (2026-05-06)

- Re-release

## [2.3.7](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.3.6...v2.3.7) (2026-05-06)

- Move the release steps into `scripts/release.mjs`

## [2.3.6](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.3.5...v2.3.6) (2026-05-06)

- Use ErrorMessage from `@jbrowse/core/ui` in ConnectStructureDialog
- Fix a handleClose bug and convert inline styles to makeStyles
- Type safety and code quality cleanups

## [2.3.5](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.3.4...v2.3.5) (2026-05-02)

- Fix the publish workflow

## [2.3.4](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.3.3...v2.3.4) (2026-05-02)

- Prevent stale async operations from overwriting state in data-fetching effects
- Migrate CI and the repo to pnpm, and ESLint to flat config with import-x
- Bump react-msaview

## [2.3.3](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.3.2...v2.3.3) (2026-04-16)

- Generate `src/version.ts` on release

## [2.3.2](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.3.1...v2.3.2) (2026-04-16)

- Publish from postversion

## [2.3.1](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.3.0...v2.3.1) (2026-04-16)

- Publish with --provenance

## [2.3.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.2.11...v2.3.0) (2026-04-15)

- Switch to pnpm, plus simplifications (#57)

## [2.2.11](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.2.8...v2.2.11) (2026-03-24)

- Run the snapshot tests on a nightly cron job

## [2.2.8](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.2.7...v2.2.8) (2026-01-30)

- Add a panel for resuming an existing NCBI BLAST RID
- Cache more of the BLAST results

## [2.2.7](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.2.5...v2.2.7) (2026-01-30)

- Read the version from a generated `version.ts` rather than package.json

## [2.2.5](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.2.4...v2.2.5) (2026-01-25)

- Dependency bumps

## [2.2.4](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.2.3...v2.2.4) (2026-01-25)

- Save NCBI BLAST results to IndexedDB (#55) and load an MSA from IndexedDB
  (#51)
- Connect the MSA view with the protein structure view (#49)
- Add an extension point for launching an MSA view from e.g. the URL bar (#47)
- Add MAF viewer integration (#52)
- Add puppeteer-based testing against multiple JBrowse versions (#53)

## [2.2.3](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.2.2...v2.2.3) (2025-10-14)

- Update g2p_mapper, fix tsc errors

## [2.2.2](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.2.1...v2.2.2) (2025-10-13)

- Create a general concept of an MSA data adapter (#43)
- Use a transcript's associated MSA dataset when it has one (#44)
- Fix the cache key

## [2.2.1](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.2.0...v2.2.1) (2025-05-29)

- Drop the msa root configuration schema, which broke plugin load

## [2.2.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.1.0...v2.2.0) (2025-05-29)

- Add a quick-blastp option to the in-app NCBI BLAST workflow (#41)

## [2.1.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.0.6...v2.1.0) (2025-05-23)

- Add the Ensembl GeneTree widget directly in the app (#39)

## [2.0.6](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.0.5...v2.0.6) (2025-05-19)

- Output distconfig.json
- Add lint to CI

## [2.0.5](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.0.4...v2.0.5) (2025-05-19)

- Split the watch script, and fix the plugin import

## [2.0.4](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.0.3...v2.0.4) (2024-08-31)

- Improve BLAST error handling and feature sequence fetching

## [2.0.3](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.0.2...v2.0.3) (2024-08-09)

- Dependency bumps

## [2.0.2](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.0.1...v2.0.2) (2024-07-16)

- Add MAFFT as an alignment option
- Add error handling to the BLAST job

## [2.0.1](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v2.0.0...v2.0.1) (2024-07-09)

- Dependency bumps

## [2.0.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.18...v2.0.0) (2024-07-08)

- Launch an MSA view for a gene by running an NCBI BLAST search from the
  browser, against nr or nr_clustered_seq
- Sync mouseover between the MSA and the linear genome view, and click to
  navigate to the genome (#29)
- Map genome<->protein coordinates with g2p_mapper
- Build with esbuild for both development and production (#37)
- Relicense as MIT

## [1.0.18](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.17...v1.0.18) (2022-01-10)

- Fix clicking on node labels

## [1.0.17](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.16...v1.0.17) (2021-11-04)

- Avoid Link redirection at react-msaview importform

## [1.0.16](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.15...v1.0.16) (2021-10-22)

- Update to latest react-msaview

## [1.0.15](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.14...v1.0.15) (2021-10-22)

- Change to add to 'Add' top level menu

## [1.0.14](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.13...v1.0.14) (2021-03-17)

- Fix session link loading from distconfig.json

## [1.0.13](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.12...v1.0.13) (2021-03-17)

- Factor out code into the react-msaview package on NPM, and make the plugin
  more of a wrapper around this module

## [1.0.12](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.11...v1.0.12) (2021-02-12)

- Avoid scrolling too far right

## [1.0.11](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.10...v1.0.11) (2021-02-12)

- Add version number from package.json to about panel

## [1.0.10](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.9...v1.0.10) (2021-02-11)

- Fix scrolling for large MSA that loads after tree

## [1.0.9](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.8...v1.0.9) (2021-02-11)

- Fix for MSA loading bar when tree only is displayed

## [1.0.8](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.7...v1.0.8) (2021-02-11)

- Fix for side scrolling half rendered letters in MSA
- drawNodeBubbles option

## [1.0.7](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.6...v1.0.7) (2021-02-10)

- Move yarn build script to prepare script in package.jsom

## [1.0.6](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.5...v1.0.6) (2021-02-10)

- Use postversion to run build so that the accurate version is encoded into the
  release binary

## [1.0.5](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.3...v1.0.5) (2021-02-10)

- Add prebuild clean

## [1.0.4](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.3...v1.0.5) (2021-02-10)

- Fix running build before release

## [1.0.3](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.2...v1.0.3) (2021-02-10)

- Re-release

## [1.0.2](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.1...v1.0.2) (2021-02-10)

- Ensure clean build with prebuild rm -rf dist

## [1.0.1](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.0...v1.0.1) (2021-02-10)

- Fix for making demo config on unpkg

## [1.0.0](https://github.com/GMOD/jbrowse-plugin-msaview/compare/v1.0.0...v1.0.0) (2021-02-10)

### Features

- Vertical virtualized scrolling of phylogenetic tree
- Vertical and horizontal virtualized scrolling of multiple sequence alignment
  as a newick tree embedded in stockholm metadata
- View metadata about alignment from MSA headers (e.g. stockholm)
- Collapse subtrees with click action on branches
- The collapse subtree action hides gaps that were introduced by that subtree in
  the rest of the alignment
- Allows "zooming out" by setting tiny rowHeight/colWidth settings
- Allows changing color schemes, with jalview, clustal, and other color schemes
- Allows toggling the branch length rendering for the phylogenetic tree
- Can share sessions with other users which will send relevant settings and
  links to files to automatically open your results
- The tree or the MSA panel can be loaded separately from each other

### File format supports

- FASTA formatted for MSA (e.g. gaps already inserted)
- Stockholm files (e.g. .stock file, with or without embedded newick tree, uses
  stockholm-js parser. also supports "multi-stockholm" files with multiple
  alignments embedded in a single file)
- Clustal files (e.g. .aln file, uses clustal-js parser)
- Newick (tree can be loaded separately as a .nh file)
