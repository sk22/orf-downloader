const extractPlaylistDataJson = () =>
  Array.from(document.querySelectorAll('[data-jsb]'))
    .map(el => el.getAttribute('data-jsb'))
    .filter(t => t.includes('m3u8'))
    .map(t => JSON.parse(t))
    .find(j => 'playlist' in j)

const makeFileName = () =>
  location.href.match(/.*\/([a-zA-Z].*?)$/)[1].replace(/\//g, '-')

const getQualityNumberOfSource = source => Number(source.quality[1]) || 0
/** sources: [{...}, {...}] => { src, quality, type, ... } */
const getHighestQualitySource = sources =>
  sources
    .filter(s => s.src.endsWith('m3u8'))
    .reduce(
      ([best, q], s) =>
        getQualityNumberOfSource(s) > q
          ? [s, getQualityNumberOfSource(s)]
          : [best, q],
      [null, 0]
    )[0] // throw away temp quality variable

const getM3uItems = m3uText =>
  m3uText
    .trim()
    .split('\n')
    .filter(l => l.length > 0 && l[0] !== '#')

const getBaseUrl = url => url.match(/.*\//)[0]

const getBaseName = url => url.slice(getBaseUrl(url).length)

/** { src, title, ... } => [ https://.../media_0.ts, ... ] */
const fetchChunklist = async source => {
  const baseUrl = getBaseUrl(source.src)
  const sourcePlaylist = await (await fetch(source.src)).text()
  const chunklistUrls = getM3uItems(sourcePlaylist).map(
    fileName => baseUrl + fileName
  )
  const chunklists = await Promise.all(
    chunklistUrls.map(url => fetch(url).then(res => res.text()))
  )
  return chunklists
    .map(getM3uItems)
    .flat()
    .map(fileName => baseUrl + fileName)
}

const fetchChunklists = async playlist => {
  const playlistWithHighestSource = playlist.map(item => ({
    ...item,
    source: getHighestQualitySource(item.sources)
  }))

  const chunkUrlsPerPlaylistItem = await Promise.all(
    playlistWithHighestSource.map(item => fetchChunklist(item.source))
  )

  return playlist.map((item, i) => ({
    ...item,
    chunks: chunkUrlsPerPlaylistItem[i]
  }))
}

async function downloader() {
  const data = extractPlaylistDataJson()

  document.body.innerHTML = ''
  const main = document.createElement('main')
  document.body.appendChild(main)

  const dataTextAreaLabel = document.createElement('small')
  dataTextAreaLabel.innerText =
    'debug data (contains links to playlists, subtitles, etc.)'
  const dataTextArea = document.createElement('textarea')
  dataTextArea.value = JSON.stringify(data, null, 2)
  main.appendChild(dataTextAreaLabel)
  main.appendChild(dataTextArea)

  Array.from(
    document.querySelectorAll('style, link[rel=stylesheet]')
  ).forEach(el => el.remove())

  /** [ { title, sources, subtitles, ... }, {...} ] */
  const { playlist } = data

  const fileName = makeFileName()

  /** [ { title, chunks, subtitles, ... } ] */
  const playlistWithChunklist = await fetchChunklists(playlist)
  console.log(playlistWithChunklist)
  const allChunks = playlistWithChunklist.map(item => item.chunks).flat()

  const videoPreviewLabel = document.createElement('p')
  const video = document.createElement('video')
  const playlistDiv = document.createElement('div')
  const selectPlaylistItem = document.createElement('select')
  const selectDiv = document.createElement('div')
  const fromLabel = document.createElement('label')
  fromLabel.innerText = 'From: '  
  const selectFrom = document.createElement('select')
  const toLabel = document.createElement('label')
  toLabel.innerText = 'To: '
  const selectTo = document.createElement('select')
  const selectAllButton = document.createElement('button')
  const downloadButton = document.createElement('button')
  const parallelCheckbox = document.createElement('input')
  parallelCheckbox.type = 'checkbox'
  const parallelLabel = document.createElement('label')
  parallelLabel.innerText = 'Parallel downloading'
  const saveLink = document.createElement('a')
  const subtitlesLink = document.createElement('a')
  const thumbnailLink = document.createElement('a')
  const descriptionLink = document.createElement('a')
  const downloadProgress = document.createElement('pre')
  const linksDiv = document.createElement('div')
  const urlsTextAreaLabel = document.createElement('small')
  urlsTextAreaLabel.innerText = 'direct links to all video chunks'
  const urlsTextArea = document.createElement('textarea')
  const infoDiv = document.createElement('div')

  main.appendChild(videoPreviewLabel)
  main.appendChild(video)
  if (playlist.length > 1) {
    main.appendChild(playlistDiv)
    playlistDiv.appendChild(selectPlaylistItem)
  }
  main.appendChild(selectDiv)
  selectDiv.appendChild(fromLabel)
  fromLabel.appendChild(selectFrom)
  selectDiv.appendChild(document.createTextNode(' '))
  selectDiv.appendChild(toLabel)
  toLabel.appendChild(selectTo)
  selectDiv.appendChild(document.createTextNode(' '))
  selectDiv.appendChild(selectAllButton)
  selectDiv.appendChild(document.createTextNode(' '))
  selectDiv.appendChild(downloadButton)
  selectDiv.appendChild(document.createTextNode(' '))
  selectDiv.appendChild(parallelLabel)
  selectDiv.appendChild(document.createTextNode(' '))
  parallelLabel.appendChild(parallelCheckbox)
  selectDiv.appendChild(document.createTextNode(' '))
  main.appendChild(linksDiv)
  linksDiv.appendChild(subtitlesLink)
  linksDiv.appendChild(document.createTextNode(' '))
  linksDiv.appendChild(thumbnailLink)
  linksDiv.appendChild(document.createTextNode(' '))
  linksDiv.appendChild(descriptionLink)
  linksDiv.appendChild(document.createTextNode(' '))
  linksDiv.appendChild(saveLink)
  main.appendChild(infoDiv)
  main.appendChild(downloadProgress)
  main.appendChild(urlsTextAreaLabel)
  main.appendChild(urlsTextArea)

  infoDiv.innerHTML = `<ul>
    <li>To download the full video, click "Select all", and then "Start download".
    <li>To download a specific clip, use the "From" and "To" boxes to select the desired time frame,
        and click "Start download".
    <li>After the download has completed, click the bold "Download" link
        to save the file to your computer.
    <li>Many media players (like VLC) should be able to play the <code>.ts</code> file.
    <li>To maximize compatiblity (for example, to share the video on social media),
        you might want to convert and re-encode it as an <code>.mp4</code> file using software like
        <a href="https://handbrake.fr/">HandBrake</a>, or an online converter like
        <a href="https://cloudconvert.com/ts-to-mp4">cloudconvert</a> (note that uploading the video
        takes extra time, so offline converters are preferred).
  </ul>`

  const divs = [playlistDiv, selectDiv, linksDiv, infoDiv]
  divs.forEach(d => (d.style.marginBottom = '0.5rem'))

  urlsTextArea.value = allChunks.join('\n')
  urlsTextArea.style.height = '5rem'

  const textAreas = [urlsTextArea, dataTextArea]
  textAreas.forEach(t => {
    t.style.width = '100%'
    t.style.minWidth = t.style.width
    t.style.maxWidth = t.style.width
  })

  main.style.maxWidth = '60rem'
  main.style.margin = '0 auto'
  document.body.style.margin = '1rem'
  document.body.style.fontFamily = 'sans-serif'

  video.style.width = '100%'
  video.setAttribute('controls', 'controls')
  video.setAttribute('autoplay', 'autoplay')

  const makeOption = (value, name) => {
    const el = document.createElement('option')
    el.value = value
    el.innerText = name
    return el
  }

  if (playlistWithChunklist.length > 1) {
    playlistWithChunklist.forEach((playlistItem, index) => {
      selectPlaylistItem.appendChild(makeOption(index, playlistItem.title))
    })
  }

  const getSelectedPlaylistItem = () =>
    playlistWithChunklist[Number(selectPlaylistItem.value) || 0]

  const updateFromToSelects = () => {
    const {
      chunks,
      subtitles,
      preview_image_url,
      description,
      title
    } = getSelectedPlaylistItem()

    const bothSelects = [selectFrom, selectTo]
    bothSelects.forEach(sel => (sel.innerHTML = ''))

    chunks.forEach(url => {
      bothSelects.forEach(sel =>
        sel.appendChild(makeOption(url, getBaseName(url)))
      )
    })

    const { src: subtitlesSrc } = subtitles.find(s => s.type === 'vtt') ||
      subtitles[0] || { src: undefined }

    if (subtitlesSrc) {
      subtitlesLink.href = subtitlesSrc
      subtitlesLink.innerText = 'Subtitles'
      const parts = subtitlesSrc.split('.')
      const ext = parts[parts.length - 1]
      subtitlesLink.download = `${fileName}.${ext}`
    }

    if (preview_image_url) {
      thumbnailLink.href = preview_image_url
      thumbnailLink.innerText = 'Thumbnail'
    }

    if (description) {
      const text = `${title}\n\n${description}`
      descriptionLink.href = 'data:text/plain,' + encodeURIComponent(text)
      descriptionLink.innerText = 'Description'
      descriptionLink.download = `${fileName}.txt`
    }
  }
  updateFromToSelects()

  const updatePreview = url => {
    video.src = url
    videoPreviewLabel.innerHTML = `Previewing <a href="${url}">${getBaseName(
      url
    )}</a>`
  }
  updatePreview(selectFrom.value)

  const updateVideoVia = select => {
    updatePreview(select.value)
    saveLink.removeAttribute('href')
    saveLink.innerText = ''
    downloadButton.disabled = false
    if (
      allChunks.indexOf(selectTo.value) < allChunks.indexOf(selectFrom.value)
    ) {
      selectTo.value = selectFrom.value
    }
  }

  selectPlaylistItem.addEventListener('change', () => {
    updateFromToSelects()
    selectAll()
  })
  selectFrom.addEventListener('change', () => updateVideoVia(selectFrom))
  selectTo.addEventListener('change', () => updateVideoVia(selectTo))

  const selectAll = () => {
    const { chunks } = getSelectedPlaylistItem()
    selectFrom.value = chunks[0]
    selectTo.value = chunks[chunks.length - 1]
    updateVideoVia(selectTo)
  }

  selectAllButton.innerText = 'Select all'
  selectAllButton.addEventListener('click', selectAll)
  selectAll()

  downloadButton.innerText = 'Start download'
  downloadButton.addEventListener('click', () => {
    downloadButton.disabled = true
    const minIndex = allChunks.indexOf(selectFrom.value)
    const maxIndex = allChunks.indexOf(selectTo.value)
    const downloadUrls = allChunks.filter(
      url =>
        allChunks.indexOf(url) >= minIndex && allChunks.indexOf(url) <= maxIndex
    )

    const progressLines = downloadUrls.map(
      url => `Downloading ${getBaseName(url)}...`
    )

    const updateProgress = () => {
      downloadProgress.innerText = progressLines.join('\n')
    }

    const finishedFile = (url, i) => {
      progressLines[i] = `Finished downloading ${getBaseName(url)}`
      updateProgress()
    }

    saveLink.removeAttribute('href')
    saveLink.innerText = 'Downloading...'

    const downloadTasks = downloadUrls.map((url, i) => () =>
      fetch(url).then(res => (finishedFile(url, i), res))
    )

    const downloadsFinished = async results => {
      console.log(results)
      saveLink.innerText = 'Finishing...'
      downloadProgress.innerText = 'Finished downloading'
      window.results = results
      const blobs = await Promise.all(results.map(r => r.blob()))
      const blob = new Blob(blobs, { type: blobs[0].type })
      console.log(blob)

      const blobUrl = URL.createObjectURL(blob)
      const downloadSpan = document.createElement('span')
      downloadSpan.style.backgroundColor = 'yellow'
      downloadSpan.style.fontWeight = 'bold'
      downloadSpan.style.padding = '0.1rem 0.3rem'
      downloadSpan.innerText = 'Download'
      saveLink.innerText = ''
      saveLink.appendChild(downloadSpan)
      saveLink.href = blobUrl
      saveLink.download = `${fileName}.ts`
      updatePreview(blobUrl)
      downloadProgress.innerText = ''
    }

    const promiseReducer = (promiseChain, currentTask) =>
      promiseChain.then(results =>
        currentTask().then(currentResult => [...results, currentResult])
      )

    if (parallelCheckbox.checked) {
      Promise.all(downloadTasks.map(t => t())).then(downloadsFinished)
    } else {
      downloadTasks
        .reduce(promiseReducer, Promise.resolve([]))
        .then(downloadsFinished)
    }
  })
}

if (location.hostname !== 'tvthek.orf.at') {
  location.href = 'https://tvthek.orf.at'
} else {
  downloader()
}
