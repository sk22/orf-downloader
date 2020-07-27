if (location.hostname !== 'tvthek.orf.at') {
  location.href = 'https://tvthek.orf.at'
} else {
  ;(async function downloader() {
    const data = Array.from(document.querySelectorAll('[data-jsb]'))
      .map(el => el.getAttribute('data-jsb'))
      .filter(t => t.includes('m3u8'))
      .map(t => JSON.parse(t))
      .find(j => 'playlist' in j)

    document.body.innerHTML = ''

    const dataTextArea = document.createElement('textarea')
    dataTextArea.value = JSON.stringify(data, null, 2)
    document.body.appendChild(dataTextArea)

    Array.from(
      document.querySelectorAll('style, link[rel=stylesheet], script')
    ).forEach(el => el.remove())

    const fileName = location.href
      .match(/.*\/([a-zA-Z].*?)$/)[1]
      .replace(/\//g, '-')

    const getQualityNumber = source => Number(source.quality[1]) || 0
    const [bestQuality] = data.playlist[0].sources
      .filter(s => s.src.endsWith('m3u8'))
      .reduce(
        ([best, q], s) =>
          getQualityNumber(s) > q ? [s, getQualityNumber(s)] : [best, q],
        [null, 0]
      )

    const playlistFile = await (await fetch(bestQuality.src)).text()
    const baseUrl = bestQuality.src.match(/.*\//)[0]
    const chunklistFilename = playlistFile
      .trim()
      .split('\n')
      .find(l => l[0] !== '#')
    const chunklistUrl = baseUrl + chunklistFilename
    const chunklistFile = await (await fetch(chunklistUrl)).text()
    const chunklistFilenames = chunklistFile
      .trim()
      .split('\n')
      .filter(l => l[0] !== '#')

    const chunklistUrls = chunklistFilenames.map(f => baseUrl + f)

    const videoPreviewLabel = document.createElement('p')
    const video = document.createElement('video')
    const selectDiv = document.createElement('div')
    const fromLabel = document.createElement('label')
    const selectFrom = document.createElement('select')
    selectFrom.name = fromLabel.htmlFor = 'from'
    const toLabel = document.createElement('label')
    const selectTo = document.createElement('select')
    selectTo.name = toLabel.htmlFor = 'to'
    const selectAllButton = document.createElement('button')
    const downloadButton = document.createElement('button')
    const parallelCheckbox = document.createElement('input')
    parallelCheckbox.type = 'checkbox'
    const parallelLabel = document.createElement('label')
    parallelLabel.innerText = 'Parallel downloading'
    parallelLabel.htmlFor = parallelCheckbox.name = 'parallel'
    const saveLink = document.createElement('a')
    const subtitlesLink = document.createElement('a')
    const thumbnailLink = document.createElement('a')
    const descriptionLink = document.createElement('a')
    const downloadProgress = document.createElement('pre')
    const urlsTextArea = document.createElement('textarea')
    const linksDiv = document.createElement('div')
    const infoDiv = document.createElement('div')

    document.body.appendChild(videoPreviewLabel)
    document.body.appendChild(video)
    document.body.appendChild(selectDiv)
    selectDiv.appendChild(fromLabel)
    selectDiv.appendChild(selectFrom)
    selectDiv.appendChild(document.createTextNode(' '))
    selectDiv.appendChild(toLabel)
    selectDiv.appendChild(selectTo)
    selectDiv.appendChild(document.createTextNode(' '))
    selectDiv.appendChild(selectAllButton)
    selectDiv.appendChild(document.createTextNode(' '))
    selectDiv.appendChild(downloadButton)
    selectDiv.appendChild(document.createTextNode(' '))
    selectDiv.appendChild(parallelLabel)
    selectDiv.appendChild(document.createTextNode(' '))
    selectDiv.appendChild(parallelCheckbox)
    selectDiv.appendChild(document.createTextNode(' '))
    selectDiv.appendChild(saveLink)
    document.body.appendChild(linksDiv)
    linksDiv.appendChild(subtitlesLink)
    linksDiv.appendChild(document.createTextNode(' '))
    linksDiv.appendChild(thumbnailLink)
    linksDiv.appendChild(document.createTextNode(' '))
    linksDiv.appendChild(descriptionLink)
    document.body.appendChild(infoDiv)
    document.body.appendChild(downloadProgress)
    document.body.appendChild(urlsTextArea)

    infoDiv.innerHTML = `<ul>
  <li>To download the full video, click "Select all", and then "Start download".
  <li>To download a specific clip, use the "From" and "To" boxes to select the desired time frame.
  <li>After the download has completed, click the bold "Download" link
      to save the file to your computer.
  <li>Many media players (like VLC) should be able to play the <code>.ts</code> file.
  <li>To maximize compatiblity (for example, to share the video on social media),
      you might want to convert and re-encode it as an <code>.mp4</code> file using software like
      <a href="https://handbrake.fr/">HandBrake</a>, or an online converter like
      <a href="https://cloudconvert.com/ts-to-mp4">cloudconvert</a> (note that uploading the video
      takes extra time, so offline converters are preferred).
  </ul>`

    const divs = [selectDiv, linksDiv, infoDiv]
    divs.forEach(d => (d.style.marginBottom = '0.5rem'))

    urlsTextArea.value = chunklistUrls.join('\n')
    urlsTextArea.style.height = '5rem'

    const textAreas = [urlsTextArea, dataTextArea]
    textAreas.forEach(t => {
      t.style.width = '100%'
      t.style.minWidth = t.style.width
      t.style.maxWidth = t.style.width
    })

    video.style.width = '100%'
    video.style.maxWidth = '50rem'
    video.setAttribute('controls', 'controls')
    video.setAttribute('autoplay', 'autoplay')

    fromLabel.innerText = 'From: '
    toLabel.innerText = 'To: '

    const links = [subtitlesLink, thumbnailLink, descriptionLink]
    links.forEach(l => {
      l.target = '_blank'
    })

    const { subtitles } = data.playlist[0]
    const subtitlesSrc = (
      subtitles.find(s => s.type === 'vtt') ||
      subtitles[0] || { src: undefined }
    ).src
    if (subtitlesSrc) {
      subtitlesLink.href = subtitlesSrc
      subtitlesLink.innerText = 'Subtitles'
      const parts = subtitlesSrc.split('.')
      const ext = parts[parts.length - 1]
      subtitlesLink.download = `${fileName}.${ext}`
    }

    if (data.playlist[0].preview_image_url) {
      thumbnailLink.href = data.playlist[0].preview_image_url
      thumbnailLink.innerText = 'Thumbnail'
    }

    if (data.playlist[0].description) {
      const text = `${data.playlist[0].title}\n\n${data.playlist[0].description}`
      descriptionLink.href = 'data:text/plain,' + encodeURIComponent(text)
      descriptionLink.innerText = 'Description'
      descriptionLink.download = `${fileName}.txt`
    }

    const makeOption = (url, name) => {
      const el = document.createElement('option')
      el.value = url
      el.innerText = name
      return el
    }

    chunklistUrls.forEach((url, i) => {
      const name = chunklistFilenames[i]
      selectFrom.appendChild(makeOption(url, name))
      selectTo.appendChild(makeOption(url, name))
    })

    const updatePreview = url => {
      video.src = url
      videoPreviewLabel.innerHTML = `Previewing <a href="${url}">${
        chunklistFilenames[chunklistUrls.indexOf(url)] || url
      }</a>`
    }
    updatePreview(selectFrom.value)

    const updateVideoVia = select => {
      updatePreview(select.value)
      saveLink.removeAttribute('href')
      saveLink.innerText = ''
      downloadButton.disabled = false
      if (
        chunklistUrls.indexOf(selectTo.value) <
        chunklistUrls.indexOf(selectFrom.value)
      ) {
        selectTo.value = selectFrom.value
      }
    }
    selectTo.addEventListener('change', () => updateVideoVia(selectTo))
    selectFrom.addEventListener('change', () => updateVideoVia(selectFrom))

    selectAllButton.innerText = 'Select all'
    selectAllButton.addEventListener('click', () => {
      selectFrom.value = chunklistUrls[0]
      selectTo.value = chunklistUrls[chunklistUrls.length - 1]
      updateVideoVia(selectTo)
    })

    downloadButton.innerText = 'Start download!'
    downloadButton.addEventListener('click', () => {
      downloadButton.disabled = true
      const minIndex = chunklistUrls.indexOf(selectFrom.value)
      const maxIndex = chunklistUrls.indexOf(selectTo.value)
      const downloadUrls = chunklistUrls.filter(
        url =>
          chunklistUrls.indexOf(url) >= minIndex &&
          chunklistUrls.indexOf(url) <= maxIndex
      )

      const progressLines = downloadUrls.map(
        url =>
          `Downloading ${chunklistFilenames[chunklistUrls.indexOf(url)]}...`
      )

      const updateProgress = () => {
        downloadProgress.innerText = progressLines.join('\n')
      }

      const finishedFile = (url, i) => {
        progressLines[i] = `Finished downloading ${
          chunklistFilenames[chunklistUrls.indexOf(url)]
        }`

        updateProgress()
      }

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
        saveLink.innerHTML = '<b>Download</b>'
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
  })()
}
