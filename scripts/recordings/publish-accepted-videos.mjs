/** Publish an explicitly authorized, strictly accepted subset as one immutable asset release.
 * Native captures, QA decisions and the full active-scope gate are never rewritten.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { validateRefreshScope } from './refresh-scope.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'))
const encoded = (v) => JSON.stringify(v, null, 2) + '\n'
const hash = (b) => crypto.createHash('sha256').update(b).digest('hex')
const sha = (f) => hash(fs.readFileSync(f))
const inside = (parent, file) => file.startsWith(path.resolve(parent) + path.sep)
const sameSet = (a, b) =>
  a.length === b.length && new Set(a).size === a.length && a.every((x) => b.includes(x))
const write = (f, v) => {
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.writeFileSync(f, encoded(v))
}
const assert = (condition, message) => {
  if (!condition) throw Error(message)
}
const familyFiles = {
  notebook: 'public/materials/notebook/provenance.json',
  skills: 'public/materials/skills/provenance.json',
  'teacher-tools': 'public/materials/teacher-tools/provenance.json',
  'chatgpt-formal': 'public/materials/chatgpt-formal/provenance.json'
}
const demoFiles = {
  notebook: 'data/demos/notebook-demos.json',
  skills: 'data/demos/skill-demos.json',
  'teacher-tools': 'data/demos/teacher-tool-demos.json'
}
const widgetProvenance = [
  'public/materials/chatgpt-widgets/videos/provenance.json',
  'public/materials/chatgpt-widgets/isolated/provenance.json'
]
const mediaFile = 'data/content/media.json',
  widgetFile = 'data/demos/chatgpt-videos.json',
  workshopFile = 'data/content/workshop-slides.json'
const labels = {
  '.pdf': 'PDF',
  '.png': 'PNG',
  '.csv': 'CSV',
  '.txt': 'text',
  '.md': 'Markdown',
  '.mmd': 'Mermaid',
  '.html': 'HTML',
  '.docx': 'Word',
  '.m4a': 'audio',
  '.mp3': 'audio'
}

function context(run, rootDirectory = ROOT) {
  const root = path.resolve(rootDirectory),
    directory = path.resolve(run),
    staging = path.join(root, 'output/review/video-refresh')
  assert(inside(staging, directory), 'Release source must be a staged recording run')
  const inventory = read(path.join(directory, 'inventory.json')),
    scope = validateRefreshScope(directory, inventory, root)
  const name = path.basename(directory)
  assert(/^\d{4}-\d{2}-\d{2}$/.test(name), 'Use a dated immutable release directory')
  return {
    root,
    run: directory,
    name,
    inventory,
    scope,
    packet: path.join(directory, 'release/packet'),
    publicPrefix: `materials/video-refresh/${name}`
  }
}

function authorization(ctx, file) {
  const f = path.resolve(file)
  assert(
    inside(ctx.run, f) && fs.existsSync(f),
    'Keep the explicit release authorization in this run'
  )
  const a = read(f)
  assert(
    a.schemaVersion === 1 &&
      a.kind === 'explicit-user-accepted-subset-release-observed-by-root' &&
      a.observedBy === '/root' &&
      typeof a.exactUserQuote === 'string' &&
      a.exactUserQuote.trim(),
    'The accepted-subset release requires the actual explicit user instruction observed by root'
  )
  const skipped = a.skippedKeys || [],
    active = ctx.inventory.items.map((i) => i.key)
  assert(
    a.releaseAcceptedOnly === true &&
      a.changeQaDecisions === false &&
      a.activeCount === active.length &&
      Number.isInteger(a.expectedAcceptedCount) &&
      a.expectedAcceptedCount > 0 &&
      a.expectedAcceptedCount === active.length - skipped.length &&
      sameSet(skipped, [...new Set(skipped)]) &&
      skipped.every((k) => active.includes(k)),
    'Authorization must name the exact accepted subset without changing any QA decision'
  )
  assert(
    sameSet(a.preservedDeferredKeys || [], ctx.scope.deferredKeys) &&
      a.preserveExistingUnreleasedAssets === true,
    'Keep the blocked item and all eight user-deferred items unchanged'
  )
  return { ...a, path: path.relative(ctx.root, f).split(path.sep).join('/'), sha256: sha(f) }
}

export function publicResult(record, { key, prefix, supplemental = [] }) {
  assert(
    record?.recipientVerified === true && record.ownerIndependent === true,
    'Every released result must have its actual independent-recipient verification'
  )
  const isFile = record.kind === 'file',
    extension = isFile ? path.extname(record.file?.path || '') : null
  if (isFile)
    assert(
      /^exports\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(record.file.path),
      'Only the registered export may be published'
    )
  else
    assert(
      /^https:\/\//.test(record.url || '') && !/^https:\/\/(?:localhost|127\.)/.test(record.url),
      'Do not publish local-review or owner-only result URLs'
    )
  const url = isFile ? `/${prefix}/${key}/${record.file.path}` : record.url
  let label = isFile
    ? `Open result (${labels[extension] || extension.slice(1)})`
    : 'Open shared result'
  let qualification
  if (record.sourceExport?.method === 'observed-ui-derived-pdf') {
    label =
      key === 'notebook-quiz' ? 'Quiz and solutions (PDF, static)' : 'Study guide (PDF, static)'
    qualification =
      'Readable static PDF derived faithfully from the observed native interface; not a native PDF download or an interactive activity.'
  } else if (record.sourceExport?.method === 'observed-ui-native-screenshot') {
    label = 'Mind map (PNG, static)'
    qualification =
      'Complete static screenshot of the native map; not an interactive map or a claimed native Download export.'
  } else if (key === 'notebook-flashcards') label = 'Flashcards (CSV)'
  if (key === 'skills-the-learning-skill') {
    label = 'Open public study-kit code'
    qualification =
      'Public-readable code companion with the exact original HTML file below. Live shared interactivity and actionable shared attachments were not verified.'
  } else if (record.readOnlySharedConversation)
    qualification = 'Readable shared conversation; live shared interactivity is not claimed.'
  return {
    kind: record.kind,
    url,
    label,
    interactiveVerified: record.interactiveVerified === true,
    recipientVerified: true,
    ownerIndependent: true,
    ...(qualification ? { qualification } : {}),
    ...(isFile
      ? {
          mediaType: record.file.mediaType,
          download: true,
          sha256: record.file.sha256,
          bytes: record.file.bytes,
          sourceMethod: record.sourceExport?.method
        }
      : {}),
    supplemental
  }
}

function protectedState(ctx) {
  const policy = read(path.resolve(ctx.root, ctx.scope.policyPath)),
    historical = read(path.resolve(ctx.root, policy.historicalInventory.path)),
    keys = [...ctx.scope.deferredKeys, 'notebook-video']
  const media = read(path.join(ctx.root, mediaFile)),
    assets = [],
    records = []
  for (const item of historical.items.filter((i) => keys.includes(i.key))) {
    const registry = read(path.join(ctx.root, item.source.metadata)),
      clipKey = item.key.replace(item.family + '-', ''),
      familyRecord = registry.clips?.find((c) => c.key === clipKey)
    records.push({
      key: item.key,
      slideId: item.slideId,
      mediaSha256: media[item.slideId] ? hash(encoded(media[item.slideId])) : null,
      ...(familyRecord
        ? {
            familyRecord: {
              path: item.source.metadata,
              key: clipKey,
              sha256: hash(encoded(familyRecord))
            }
          }
        : {})
    })
    for (const field of ['src', 'poster', 'captions'])
      if (item.source[field]) {
        const relative = 'public/' + item.source[field],
          file = path.resolve(ctx.root, relative)
        assert(
          inside(path.join(ctx.root, 'public'), file) && fs.existsSync(file),
          'Preserved recording asset is missing: ' + relative
        )
        assets.push({ path: relative, sha256: sha(file) })
      }
  }
  return { keys, assets, records }
}

function verifyProtected(ctx, protection) {
  const media = read(path.join(ctx.root, mediaFile))
  for (const a of protection.assets)
    assert(
      fs.existsSync(path.join(ctx.root, a.path)) && sha(path.join(ctx.root, a.path)) === a.sha256,
      'Unreleased asset changed: ' + a.path
    )
  for (const r of protection.records) {
    assert(
      (media[r.slideId] ? hash(encoded(media[r.slideId])) : null) === r.mediaSha256,
      'Unreleased media reference changed: ' + r.key
    )
    if (r.familyRecord) {
      const f = r.familyRecord,
        current = read(path.join(ctx.root, f.path)).clips.find((c) => c.key === f.key)
      assert(
        current && hash(encoded(current)) === f.sha256,
        'Unreleased provenance changed: ' + r.key
      )
    }
  }
}

function localFile(ctx, directory, relative) {
  const file = path.resolve(directory, relative)
  assert(
    inside(directory, file) &&
      fs.existsSync(file) &&
      fs.lstatSync(file).isFile() &&
      !fs.lstatSync(file).isSymbolicLink(),
    'Unsafe or missing release input: ' + relative
  )
  return file
}

/** Prepare and verify every byte before any live path is changed. */
export function prepareAcceptedRelease({ run, authorizationPath, auditRun, rootDirectory = ROOT }) {
  const ctx = context(run, rootDirectory),
    auth = authorization(ctx, authorizationPath)
  assert(
    !fs.existsSync(ctx.packet),
    'A prepared packet already exists; verify/apply it instead of silently replacing its evidence'
  )
  const selected = ctx.inventory.items.filter(
    (i) =>
      fs.existsSync(path.join(ctx.run, i.directory, 'qa.json')) &&
      read(path.join(ctx.run, i.directory, 'qa.json')).accepted === true
  )
  assert(
    selected.length === auth.expectedAcceptedCount &&
      sameSet(
        ctx.inventory.items.filter((i) => !selected.includes(i)).map((i) => i.key),
        auth.skippedKeys
      ),
    'The actual accepted subset differs from the user-authorized release'
  )
  const audit = auditRun(ctx.run, { onlyKeys: selected.map((i) => i.key) })
  assert(
    audit.inventoryValid &&
      audit.activeScope.valid &&
      audit.accepted === selected.length &&
      !audit.issues.length &&
      audit.pilotPassed &&
      !audit.scopeUnreviewed.length,
    'Every selected item must pass current strict source, output and recipient QA'
  )
  const protection = protectedState(ctx),
    files = [],
    clips = [],
    operations = []
  fs.mkdirSync(path.join(ctx.packet, 'assets'), { recursive: true })
  write(path.join(ctx.packet, 'selected-strict-audit.json'), audit)
  function copy(source, relative, expected) {
    assert(
      relative.startsWith(ctx.publicPrefix + '/') && !relative.includes('..'),
      'Release assets must stay in the immutable public namespace'
    )
    assert(sha(source) === expected, 'Release input hash changed: ' + source)
    const destination = path.join(ctx.packet, 'assets', relative.slice(ctx.publicPrefix.length + 1))
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.copyFileSync(source, destination)
    assert(sha(destination) === expected, 'Prepared asset copy differs from its accepted source')
    const entry = { path: relative, sha256: expected, bytes: fs.statSync(destination).size }
    files.push(entry)
    return entry
  }
  function jsonAsset(relative, value) {
    const bytes = encoded(value),
      destination = path.join(ctx.packet, 'assets', relative.slice(ctx.publicPrefix.length + 1))
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.writeFileSync(destination, bytes)
    const entry = { path: relative, sha256: hash(bytes), bytes: Buffer.byteLength(bytes) }
    files.push(entry)
    return entry
  }
  for (const item of selected) {
    const directory = path.join(ctx.run, item.directory),
      render = read(path.join(directory, 'render.json')),
      qa = read(path.join(directory, 'qa.json')),
      source = path.resolve(ctx.root, render.capture.path),
      capture = read(path.join(source, 'capture.json')),
      result = read(path.join(directory, 'result.json'))
    const command = item.command || item.source.pointer?.command
    const output = {}
    for (const name of ['video', 'poster', 'captions', 'transcript']) {
      const f = render.files[name]
      output[name] = copy(
        localFile(ctx, directory, f.path),
        `${ctx.publicPrefix}/${item.key}/${path.basename(f.path)}`,
        f.sha256
      )
    }
    const supplemental = []
    function exportFile(record, supplement = false) {
      const descriptor = publicResult(record, { key: item.key, prefix: ctx.publicPrefix })
      copy(
        localFile(ctx, directory, record.file.path),
        `${ctx.publicPrefix}/${item.key}/${record.file.path}`,
        record.file.sha256
      )
      if (supplement) {
        descriptor.label = `Original result (${labels[path.extname(record.file.path)] || 'file'})`
        delete descriptor.supplemental
        supplemental.push(descriptor)
      }
      return descriptor
    }
    if (result.kind === 'file') exportFile(result)
    for (const name of result.supplementalFileResults || []) {
      assert(/^supplemental-[a-z0-9-]+\.json$/.test(name), 'Unsafe supplemental record')
      exportFile(read(localFile(ctx, directory, name)), true)
    }
    const resultLink = publicResult(result, {
        key: item.key,
        prefix: ctx.publicPrefix,
        supplemental
      }),
      transcript = fs.readFileSync(path.join(directory, render.files.transcript.path), 'utf8'),
      prompt = capture.prompt || item.originalPrompt || ''
    const chapters = render.phaseTimings
      .filter((p) => p.seconds >= 0 && p.seconds < render.durationSeconds)
      .map((p) => ({ label: p.name.replaceAll('-', ' '), atSeconds: p.seconds, rate: p.rate }))
    const provenance = `${ctx.publicPrefix}/provenance/${item.key}.json`
    const media = {
      type: 'video',
      src: output.video.path,
      poster: output.poster.path,
      captions: output.captions.path,
      transcriptFile: output.transcript.path,
      captionsDefault: false,
      browserFrame: true,
      alt: `${item.service} — ${item.title}: recorded demonstration and use.`,
      caption: `${item.service} · ${render.durationSeconds.toFixed(1)} s`,
      transcript,
      prompt,
      result: resultLink,
      provenance,
      durationSeconds: render.durationSeconds,
      width: render.width,
      height: render.height,
      fps: render.fps,
      sha256: output.video.sha256,
      recordingMode: 'accepted-native-refresh',
      refreshReleaseId: ctx.name
    }
    const recording = {
      key: item.key.replace(new RegExp('^' + item.family + '-'), ''),
      recordingKey: item.key,
      slideId: item.slideId,
      ...(command ? { command } : {}),
      status: 'executed',
      accepted: true,
      browser: '@Browser',
      recordedAt: capture.startedAt,
      ...media,
      transcript: undefined,
      videoSha256: output.video.sha256,
      posterSha256: output.poster.sha256,
      captureFrameCount: render.capture.sourceFrames,
      scenes: render.phaseTimings.map((p) => ({
        phase: p.name,
        atSeconds: p.seconds,
        rate: p.rate
      })),
      chapters,
      capture: {
        sha256: render.capture.sha256,
        sourceFrames: render.capture.sourceFrames,
        usedFrames: render.capture.usedFrames,
        conversationFingerprint: hash(
          String(render.capture.ownerConversationUrl || capture.conversationUrl || item.key)
        ),
        newChat: capture.newChat === true,
        temporaryChat: capture.temporaryChat === true,
        interfaceLanguage: capture.interfaceLanguage || capture.uiLanguage || 'en'
      },
      qa: {
        accepted: true,
        videoSha256: qa.videoSha256,
        captureSha256: qa.captureSha256,
        recordSha256: sha(path.join(directory, 'qa.json')),
        rootReviewSha256: qa.rootReview?.sha256,
        independentPeerReviewSha256: qa.independentPeerReview?.sha256
      },
      sourceBook: {
        path: ctx.inventory.sourceBook.path.replace(/^public\//, ''),
        sha256: ctx.inventory.sourceBook.sha256
      },
      sourceMethod:
        'Genuine native recording; setup/input3x, generation4x and actual use1x. Exact reviewed technical exclusions and source lineage remain in the retained private QA packet.'
    }
    jsonAsset(provenance, recording)
    const entry = {
      key: item.key,
      family: item.family,
      slideId: item.slideId,
      ...(command ? { command } : {}),
      media,
      files: output,
      captureSha256: render.capture.sha256,
      qaSha256: sha(path.join(directory, 'qa.json')),
      resultRecordSha256: sha(path.join(directory, 'result.json'))
    }
    clips.push(entry)
    operations.push({
      item: {
        key: item.key,
        family: item.family,
        slideId: item.slideId,
        command,
        pointer: item.source.pointer
      },
      media,
      recording,
      chapters,
      sourceCapturePath: render.capture.path,
      qaSha256: entry.qaSha256,
      renderSha256: sha(path.join(directory, 'render.json')),
      resultSha256: entry.resultRecordSha256
    })
  }
  const publicAuthorization = {
    exactUserQuote: auth.exactUserQuote,
    observedBy: auth.observedBy,
    observedAt: auth.observedAt,
    releaseAcceptedOnly: true,
    changeQaDecisions: false
  }
  const manifest = {
    schemaVersion: 1,
    kind: 'accepted-subset-video-release',
    releaseId: ctx.name,
    run: ctx.name,
    preparedAt: new Date().toISOString(),
    activeCount: ctx.inventory.items.length,
    releasedCount: selected.length,
    allActiveQaAccepted: selected.length === ctx.inventory.items.length,
    skippedKeys: auth.skippedKeys,
    deferredKeys: ctx.scope.deferredKeys,
    authorization: publicAuthorization,
    clips,
    files,
    operationsSha256: hash(encoded(operations)),
    preserved: { keys: protection.keys, existingAssetsUnchanged: true },
    scopePolicySha256: ctx.scope.policySha256
  }
  write(path.join(ctx.packet, 'assets/release-manifest.json'), manifest)
  write(path.join(ctx.packet, 'packet.json'), {
    schemaVersion: 1,
    kind: 'accepted-subset-release-packet',
    run: ctx.run,
    root: ctx.root,
    publicPrefix: ctx.publicPrefix,
    authorization: auth,
    manifestSha256: sha(path.join(ctx.packet, 'assets/release-manifest.json')),
    protection,
    operations,
    preparedAt: manifest.preparedAt
  })
  return {
    packet: ctx.packet,
    manifestSha256: sha(path.join(ctx.packet, 'assets/release-manifest.json')),
    releaseAllowed: true,
    selected: selected.length,
    skipped: auth.skippedKeys,
    liveFilesChanged: false
  }
}

function registryUpdates(ctx, packet) {
  const docs = new Map(),
    get = (relative) => {
      if (!docs.has(relative)) docs.set(relative, read(path.join(ctx.root, relative)))
      return docs.get(relative)
    }
  const widgetDates = [
    ...new Set(
      packet.operations
        .filter((o) => o.item.family === 'chatgpt-widgets')
        .map((o) => o.recording.recordedAt.slice(0, 10))
    )
  ].sort()
  for (const op of packet.operations) {
    const { item, media, recording, chapters } = op
    if (item.family === 'chatgpt-widgets') {
      get(mediaFile)[item.slideId] = media
      const catalogue = get(widgetFile),
        index = catalogue.clips.findIndex(
          (c) => c.command?.toLowerCase() === item.command.toLowerCase()
        )
      const clip = {
        ...media,
        command: item.command,
        prompt: media.prompt,
        temporaryChat: recording.capture.temporaryChat,
        interfaceLanguage: recording.capture.interfaceLanguage,
        chapters
      }
      if (index < 0) catalogue.clips.push(clip)
      else catalogue.clips[index] = clip
      catalogue.recordingDates = widgetDates
      catalogue.recordedOn =
        widgetDates.length === 1 ? widgetDates[0] : `${widgetDates[0]} – ${widgetDates.at(-1)}`
      for (const relative of widgetProvenance) {
        const doc = get(relative)
        doc.clips ||= []
        const at = doc.clips.findIndex(
          (c) => c.command?.toLowerCase() === item.command.toLowerCase()
        )
        if (at < 0) doc.clips.push(recording)
        else doc.clips[at] = recording
        doc.refreshReleaseId = ctx.name
      }
    } else if (item.family === 'chatgpt-formal') {
      const slides = get(workshopFile),
        slide = slides.find((s) => s.id === item.slideId),
        command = slide?.commands?.find((c) => c.command === item.command)
      assert(command?.result?.media, 'The two formal media targets must still exist')
      command.result.media = media
      const doc = get(familyFiles[item.family]),
        at = doc.actions.findIndex((a) => a.action === item.command)
      assert(at >= 0, 'Formal action is missing from its existing registry')
      doc.actions[at] = {
        action: item.command,
        status: 'executed',
        recordedAt: recording.recordedAt,
        video: recording,
        result: media.result
      }
      doc.refreshReleaseId = ctx.name
    } else {
      get(mediaFile)[item.slideId] = media
      const doc = get(familyFiles[item.family]),
        at = doc.clips.findIndex((c) => c.key === recording.key)
      assert(at >= 0, 'Family clip is missing from its existing registry: ' + item.key)
      const packageSource = doc.clips[at].packageSource
      doc.clips[at] = { ...recording, ...(packageSource ? { packageSource } : {}) }
      doc.refreshReleaseId = ctx.name
      if (demoFiles[item.family]) {
        const demos = get(demoFiles[item.family]),
          demo = demos.find((d) => d.slideId === item.slideId || d.key === recording.key)
        assert(demo, 'Demo is missing from its existing registry: ' + item.key)
        Object.assign(demo, {
          recording: doc.clips[at],
          media,
          result: media.result,
          recordedPrompt: media.prompt,
          recordedOn: recording.recordedAt.slice(0, 10)
        })
        if (item.family === 'skills') demo.conversationUrl = media.result.url
      }
    }
  }
  docs.set('data/demos/video-release.json', {
    manifest: `${ctx.publicPrefix}/release-manifest.json`
  })
  return docs
}

/** Verify an immutable packet or its installed counterpart without re-running native capture. */
export function verifyAcceptedRelease({ run, installed = false, rootDirectory = ROOT }) {
  const ctx = context(run, rootDirectory),
    packet = read(path.join(ctx.packet, 'packet.json')),
    base = installed
      ? path.join(ctx.root, 'public', ctx.publicPrefix)
      : path.join(ctx.packet, 'assets')
  authorization(ctx, path.join(ctx.root, packet.authorization.path))
  verifyProtected(ctx, packet.protection)
  const manifestFile = path.join(base, 'release-manifest.json')
  assert(sha(manifestFile) === packet.manifestSha256, 'Release manifest changed')
  const manifest = read(manifestFile)
  assert(
    manifest.releasedCount === packet.authorization.expectedAcceptedCount &&
      sameSet(
        manifest.clips.map((c) => c.key),
        packet.operations.map((o) => o.item.key)
      ),
    'Release selection changed'
  )
  const actualAccepted = ctx.inventory.items
    .filter(
      (i) =>
        fs.existsSync(path.join(ctx.run, i.directory, 'qa.json')) &&
        read(path.join(ctx.run, i.directory, 'qa.json')).accepted === true
    )
    .map((i) => i.key)
  assert(
    actualAccepted.length === manifest.releasedCount &&
      sameSet(
        actualAccepted,
        manifest.clips.map((c) => c.key)
      ) &&
      hash(encoded(packet.operations)) === manifest.operationsSha256,
    'Release operations differ from the accepted selection'
  )
  for (const f of manifest.files) {
    const file = path.resolve(base, f.path.slice(ctx.publicPrefix.length + 1))
    assert(
      inside(base, file) &&
        fs.existsSync(file) &&
        sha(file) === f.sha256 &&
        fs.statSync(file).size === f.bytes,
      'Published asset differs: ' + f.path
    )
  }
  for (const op of packet.operations) {
    const item = ctx.inventory.items.find((i) => i.key === op.item.key),
      entry = manifest.clips.find((c) => c.key === op.item.key)
    assert(
      item?.family === op.item.family &&
        item.slideId === op.item.slideId &&
        JSON.stringify(entry.media) === JSON.stringify(op.media),
      'Registry operation changed after preparation'
    )
    const source = path.join(ctx.run, op.item.key)
    assert(
      sha(path.join(source, 'qa.json')) === op.qaSha256 &&
        sha(path.join(source, 'render.json')) === op.renderSha256 &&
        sha(path.join(source, 'result.json')) === op.resultSha256,
      'Accepted source/QA changed after preparation: ' + op.item.key
    )
    if (installed) {
      let current
      if (op.item.family === 'chatgpt-widgets')
        current = read(path.join(ctx.root, widgetFile)).clips.find(
          (c) => c.command.toLowerCase() === op.item.command.toLowerCase()
        )
      else if (op.item.family === 'chatgpt-formal')
        current = read(path.join(ctx.root, workshopFile))
          .find((s) => s.id === op.item.slideId)
          .commands.find((c) => c.command === op.item.command).result.media
      else current = read(path.join(ctx.root, mediaFile))[op.item.slideId]
      for (const k of ['src', 'poster', 'captions', 'transcriptFile', 'sha256'])
        assert(
          current?.[k] === op.media[k],
          'Registry differs from release: ' + op.item.key + ' ' + k
        )
      assert(
        JSON.stringify(current.result) === JSON.stringify(op.media.result),
        'Result link differs from release'
      )
    }
  }
  if (installed)
    assert(
      read(path.join(ctx.root, 'data/demos/video-release.json')).manifest ===
        `${ctx.publicPrefix}/release-manifest.json`,
      'Current release pointer differs'
    )
  return {
    verified: true,
    installed,
    released: manifest.releasedCount,
    assetFiles: manifest.files.length,
    manifestSha256: packet.manifestSha256,
    preservedKeys: packet.protection.keys,
    allActiveQaAccepted: manifest.allActiveQaAccepted
  }
}

/** Install all assets by one directory rename, then atomically replace registries.
 * A journal and backups roll back every registry if any write or check fails.
 */
export function applyAcceptedRelease({ run, rootDirectory = ROOT }) {
  const ctx = context(run, rootDirectory),
    packet = read(path.join(ctx.packet, 'packet.json'))
  const final = path.join(ctx.root, 'public', ctx.publicPrefix),
    commit = path.join(ctx.packet, 'committed.json')
  if (fs.existsSync(commit))
    return {
      ...verifyAcceptedRelease({ run, installed: true, rootDirectory }),
      alreadyCommitted: true
    }
  verifyAcceptedRelease({ run, rootDirectory })
  assert(!fs.existsSync(final), 'An existing immutable release cannot be overwritten')
  const docs = registryUpdates(ctx, packet),
    backup = path.join(ctx.packet, 'registry-backup'),
    entries = []
  for (const [relative, value] of docs) {
    const file = path.join(ctx.root, relative),
      before = fs.existsSync(file) ? fs.readFileSync(file) : null,
      temporary = file + '.video-refresh.tmp'
    assert(!fs.existsSync(temporary), 'Concurrent registry transaction exists')
    fs.mkdirSync(path.dirname(path.join(backup, relative)), { recursive: true })
    if (before !== null) fs.writeFileSync(path.join(backup, relative), before)
    entries.push({
      path: relative,
      beforeSha256: before === null ? null : hash(before),
      afterSha256: hash(encoded(value)),
      temporary,
      value
    })
  }
  const journal = path.join(ctx.packet, 'transaction.json')
  write(journal, {
    state: 'prepared',
    assetDirectory: ctx.publicPrefix,
    entries: entries.map(({ temporary, value, ...e }) => e)
  })
  let assetsInstalled = false
  try {
    for (const e of entries) {
      const file = path.join(ctx.root, e.path)
      assert(
        (fs.existsSync(file) ? sha(file) : null) === e.beforeSha256,
        'Registry changed during preparation: ' + e.path
      )
      fs.writeFileSync(e.temporary, encoded(e.value))
    }
    fs.mkdirSync(path.dirname(final), { recursive: true })
    fs.renameSync(path.join(ctx.packet, 'assets'), final)
    assetsInstalled = true
    for (const e of entries) {
      const file = path.join(ctx.root, e.path)
      assert(
        (fs.existsSync(file) ? sha(file) : null) === e.beforeSha256,
        'Concurrent registry edit: ' + e.path
      )
      fs.renameSync(e.temporary, file)
    }
    const report = verifyAcceptedRelease({ run, installed: true, rootDirectory })
    write(commit, {
      schemaVersion: 1,
      committedAt: new Date().toISOString(),
      manifestSha256: packet.manifestSha256,
      ...report,
      registryChanges: entries.map(({ temporary, value, ...e }) => e),
      fullActiveQaGateOverridden: false,
      acceptedSubsetReleaseAuthorized: true
    })
    write(journal, {
      state: 'committed',
      manifestSha256: packet.manifestSha256,
      registryFiles: entries.map((e) => e.path)
    })
    return {
      ...report,
      committed: true,
      publicManifest: `${ctx.publicPrefix}/release-manifest.json`
    }
  } catch (error) {
    for (const e of entries) {
      const file = path.join(ctx.root, e.path)
      if (fs.existsSync(file) && sha(file) === e.afterSha256) {
        if (e.beforeSha256 === null) fs.unlinkSync(file)
        else fs.copyFileSync(path.join(backup, e.path), file)
      }
      if (fs.existsSync(e.temporary)) fs.unlinkSync(e.temporary)
    }
    if (assetsInstalled) fs.renameSync(final, path.join(ctx.packet, 'assets'))
    write(journal, { state: 'rolled-back', error: error.message })
    throw error
  }
}
