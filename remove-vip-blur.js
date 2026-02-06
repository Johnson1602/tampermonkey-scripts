// ==UserScript==
// @name         Remove VIP Blur
// @namespace    https://github.com/Johnson1602/tampermonkey-scripts
// @version      0.0.13
// @description  Removes VIP paywall blur and overlay, adds copy/archive actions for videos
// @author       Weiyi Xu
// @license      MIT
// @match        https://*.mukaku.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=mukaku.com
// @grant        none
// @downloadURL  https://github.com/Johnson1602/tampermonkey-scripts/blob/main/remove-vip-blur.js
// @updateURL    https://github.com/Johnson1602/tampermonkey-scripts/blob/main/remove-vip-blur.js
// ==/UserScript==

;(function () {
  'use strict'

  // Copy icon SVG
  const COPY_ICON = `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" class="arco-icon arco-icon-copy" stroke-width="4" stroke-linecap="butt" stroke-linejoin="miter"><path d="M20 6h18a2 2 0 0 1 2 2v22a2 2 0 0 1-2 2H20a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"></path><path d="M10 16v24a2 2 0 0 0 2 2h24"></path></svg>`
  const ARCHIVE_STORAGE_KEY = 'tm:mukaku:all-hosts:archivedVideos:v1'
  const ARCHIVE_STORE_VERSION = 1
  const ARCHIVE_STYLE_ID = 'tm-video-archive-style'
  const ARCHIVE_VISIBILITY_TOGGLE_ID = 'tm-archive-visibility-toggle'
  let hideArchivedVideos = true
  let archiveStoreCache = null

  function removeVipRestrictions() {
    // Remove the VIP gate overlay
    const overlay = document.querySelector('.vip-gate-overlay')
    if (overlay) {
      overlay.remove()
    }

    // Find elements with blur/pointer-events/user-select restrictions and remove them
    const blurredElements = document.querySelectorAll(
      '[style*="blur"], [style*="pointer-events: none"], [style*="user-select: none"]',
    )

    blurredElements.forEach((el) => {
      el.style.filter = ''
      el.style.pointerEvents = ''
      el.style.userSelect = ''
    })
  }

  function addCopyButtons() {
    // Find all magnet links that don't already have a copy button
    const magnetLinks = document.querySelectorAll('.magnet-link')

    magnetLinks.forEach((magnetLink) => {
      // Check if copy button already exists
      if (magnetLink.previousElementSibling?.classList.contains('copy-link')) {
        return
      }

      const magnetUrl = magnetLink.href

      // Create copy button
      const copyButton = document.createElement('a')
      copyButton.href = '#'
      copyButton.className = 'copy-link'
      copyButton.title = '复制磁力链接'
      copyButton.innerHTML = `${COPY_ICON} 复制`
      copyButton.style.cssText =
        'display: inline-flex; align-items: center; justify-content: center; gap: 4px; padding: 4px 10px; font-size: 0.85rem; border-radius: 4px; font-weight: 500; text-decoration: none; border: 1px solid transparent; cursor: pointer; background-color: #10b981cc; color: white;'

      copyButton.addEventListener('click', (e) => {
        e.preventDefault()
        navigator.clipboard.writeText(magnetUrl).then(() => {
          const originalText = copyButton.innerHTML
          copyButton.innerHTML = `${COPY_ICON} 已复制`
          setTimeout(() => {
            copyButton.innerHTML = originalText
          }, 1500)
        })
      })

      // Insert before magnet link
      magnetLink.parentNode.insertBefore(copyButton, magnetLink)
    })
  }

  function setupDoubanRatingLinks() {
    if (!document.body || document.body.dataset.doubanRatingBound === '1') {
      return
    }

    document.body.dataset.doubanRatingBound = '1'

    document.addEventListener(
      'click',
      (e) => {
        const target = e.target
        if (!(target instanceof Element)) {
          return
        }

        const ratingTag = target.closest('.rating-tag')
        if (!ratingTag || !ratingTag.querySelector('.rating-logo.douban')) {
          return
        }

        const cardLink = ratingTag.closest('a[href]')
        if (!cardLink) {
          return
        }

        const href = cardLink.getAttribute('href') || ''
        const idMatch = href.match(/\/mv\/(\d+)/)
        if (!idMatch) {
          return
        }

        e.preventDefault()
        e.stopPropagation()

        const doubanUrl = `https://movie.douban.com/subject/${idMatch[1]}`
        window.open(doubanUrl, '_blank', 'noopener')
      },
      true,
    )
  }

  function markDoubanTagsClickable() {
    const ratingTags = document.querySelectorAll('.rating-tag')

    ratingTags.forEach((ratingTag) => {
      if (!ratingTag.querySelector('.rating-logo.douban')) {
        return
      }

      if (ratingTag.dataset.doubanLinkReady === '1') {
        return
      }

      ratingTag.dataset.doubanLinkReady = '1'
      ratingTag.style.cursor = 'pointer'
      if (!ratingTag.getAttribute('title')) {
        ratingTag.setAttribute('title', '打开豆瓣页面')
      }
    })
  }

  function ensureDoubanUnknownTags() {
    const videoCards = document.querySelectorAll('a.video-card[href]')

    videoCards.forEach((card) => {
      const hasDoubanTag = card.querySelector('.rating-tag .rating-logo.douban')
      if (hasDoubanTag) {
        return
      }

      const cardMetaBottom = card.querySelector('.card-meta-bottom')
      if (!cardMetaBottom) {
        return
      }

      let ratingsBottom = cardMetaBottom.querySelector('.card-ratings-bottom')
      if (!ratingsBottom) {
        ratingsBottom = document.createElement('div')
        ratingsBottom.className = 'card-ratings-bottom'
        cardMetaBottom.appendChild(ratingsBottom)
      }

      const wrapper = document.createElement('span')
      const tag = document.createElement('span')
      tag.className =
        'arco-tag arco-tag-size-small arco-tag-green arco-tag-checked rating-tag'
      tag.innerHTML = '<span class="rating-logo douban">豆</span> unknown'
      wrapper.appendChild(tag)

      ratingsBottom.prepend(wrapper)
    })
  }

  function createEmptyArchiveStore() {
    return {
      version: ARCHIVE_STORE_VERSION,
      updatedAt: Date.now(),
      items: {},
    }
  }

  function loadArchiveStore() {
    if (archiveStoreCache) {
      return archiveStoreCache
    }

    try {
      const raw = window.localStorage.getItem(ARCHIVE_STORAGE_KEY)
      if (!raw) {
        archiveStoreCache = createEmptyArchiveStore()
        return archiveStoreCache
      }

      const parsed = JSON.parse(raw)
      const normalized = createEmptyArchiveStore()
      normalized.updatedAt =
        typeof parsed?.updatedAt === 'number'
          ? parsed.updatedAt
          : normalized.updatedAt

      if (parsed?.items && typeof parsed.items === 'object') {
        Object.entries(parsed.items).forEach(([videoId, meta]) => {
          if (!/^\d+$/.test(videoId)) {
            return
          }

          const archivedAt =
            typeof meta?.archivedAt === 'number' &&
            Number.isFinite(meta.archivedAt)
              ? meta.archivedAt
              : Date.now()

          normalized.items[videoId] = { archivedAt }
        })
      }

      archiveStoreCache = normalized
      return archiveStoreCache
    } catch {
      archiveStoreCache = createEmptyArchiveStore()
      return archiveStoreCache
    }
  }

  function saveArchiveStore(store) {
    store.version = ARCHIVE_STORE_VERSION
    store.updatedAt = Date.now()
    archiveStoreCache = store

    try {
      window.localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(store))
    } catch {
      // Ignore quota/security errors; runtime state still works for this session.
    }
  }

  function isVideoPersistedArchived(videoId) {
    const store = loadArchiveStore()
    return Boolean(store.items[videoId])
  }

  function setVideoPersistedArchived(videoId, archived) {
    const store = loadArchiveStore()
    if (archived) {
      if (!store.items[videoId]) {
        store.items[videoId] = { archivedAt: Date.now() }
      }
    } else {
      delete store.items[videoId]
    }

    saveArchiveStore(store)
  }

  function getVideoIdFromCard(card) {
    if (!(card instanceof Element)) {
      return null
    }

    const href = card.getAttribute('href') || ''
    const match = href.match(/\/mv\/(\d+)/)
    return match ? match[1] : null
  }

  function getPrimaryVideoGrid() {
    const grids = Array.from(document.querySelectorAll('.video-list-section .video-grid'))
    return grids.find((grid) => !grid.closest('#tm-archived-section')) || null
  }

  function cleanupLegacyArchivedSection() {
    const legacySection = document.getElementById('tm-archived-section')
    if (!(legacySection instanceof Element)) {
      return
    }

    const primaryGrid = getPrimaryVideoGrid()
    if (primaryGrid) {
      const legacyCards = Array.from(
        legacySection.querySelectorAll('a.video-card[href]'),
      )
      legacyCards.forEach((card) => {
        primaryGrid.appendChild(card)
      })
    }

    legacySection.remove()
  }

  function ensureArchiveStyles() {
    if (!document.head || document.getElementById(ARCHIVE_STYLE_ID)) {
      return
    }

    const style = document.createElement('style')
    style.id = ARCHIVE_STYLE_ID
    style.textContent = `
      a.video-card.tm-archived-hidden {
        display: none !important;
      }
      .tm-archive-visibility-toggle {
        margin-right: 8px;
      }
      .tm-archive-visibility-toggle[data-tm-state="hidden"] {
        border-color: rgba(245, 158, 11, 0.55);
        color: #92400e;
      }
      .tm-archive-visibility-toggle[data-tm-state="shown"] {
        border-color: rgba(16, 185, 129, 0.55);
        color: #065f46;
      }
      .tm-archive-action-wrap {
        display: inline-flex;
        margin-left: 6px;
        vertical-align: middle;
      }
      .tm-archive-btn {
        appearance: none;
        border: 1px solid rgba(148, 163, 184, 0.55);
        background: rgba(248, 250, 252, 0.9);
        color: #334155;
        border-radius: 999px;
        padding: 3px 10px;
        font-size: 11px;
        line-height: 1.2;
        font-weight: 600;
        cursor: pointer;
      }
      .tm-archive-btn:hover {
        background: rgba(241, 245, 249, 0.95);
      }
      .tm-archive-btn[data-tm-archive-action="unarchive"] {
        border-color: rgba(16, 185, 129, 0.55);
        color: #065f46;
      }
    `

    document.head.appendChild(style)
  }

  function findArchiveToggleAnchor() {
    const loginButton = document.querySelector('button.login-btn, .login-btn')
    if (loginButton instanceof HTMLElement) {
      return loginButton
    }

    const registerButton = document.querySelector('button.register-btn, .register-btn')
    if (registerButton instanceof HTMLElement) {
      return registerButton
    }

    return null
  }

  function syncArchiveVisibilityToggleState(toggleButton) {
    if (!(toggleButton instanceof HTMLButtonElement)) {
      return
    }

    const state = hideArchivedVideos ? 'hidden' : 'shown'
    const text = hideArchivedVideos ? 'Show Archived' : 'Hide Archived'
    const title = hideArchivedVideos
      ? 'Show archived videos'
      : 'Hide archived videos'

    if (toggleButton.dataset.tmState !== state) {
      toggleButton.dataset.tmState = state
    }

    if (toggleButton.textContent !== text) {
      toggleButton.textContent = text
    }

    if (toggleButton.title !== title) {
      toggleButton.title = title
    }
  }

  function ensureArchiveVisibilityToggle() {
    const anchor = findArchiveToggleAnchor()
    if (!(anchor instanceof HTMLElement)) {
      return
    }

    let toggleButton = document.getElementById(ARCHIVE_VISIBILITY_TOGGLE_ID)
    if (!(toggleButton instanceof HTMLButtonElement)) {
      toggleButton = document.createElement('button')
      toggleButton.type = 'button'
      toggleButton.id = ARCHIVE_VISIBILITY_TOGGLE_ID
      toggleButton.className =
        'arco-btn arco-btn-outline arco-btn-shape-round arco-btn-size-small arco-btn-status-normal tm-archive-visibility-toggle'

      toggleButton.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()

        hideArchivedVideos = !hideArchivedVideos
        syncArchiveVisibilityToggleState(toggleButton)
        refreshArchiveUi()
      })
    }

    if (
      anchor.parentNode &&
      (toggleButton.parentNode !== anchor.parentNode ||
        toggleButton.nextElementSibling !== anchor)
    ) {
      anchor.parentNode.insertBefore(toggleButton, anchor)
    }

    syncArchiveVisibilityToggleState(toggleButton)
  }

  function setArchiveButtonState(button, action, text, title) {
    if (button.dataset.tmArchiveAction !== action) {
      button.dataset.tmArchiveAction = action
    }

    if (button.textContent !== text) {
      button.textContent = text
    }

    if (button.title !== title) {
      button.title = title
    }
  }

  function ensureArchiveButton(card) {
    let button = card.querySelector('button.tm-archive-btn')
    if (button) {
      return button
    }

    const cardMetaBottom = card.querySelector('.card-meta-bottom')
    if (!cardMetaBottom) {
      return null
    }

    let ratingsBottom = cardMetaBottom.querySelector('.card-ratings-bottom')
    if (!ratingsBottom) {
      ratingsBottom = document.createElement('div')
      ratingsBottom.className = 'card-ratings-bottom'
      cardMetaBottom.appendChild(ratingsBottom)
    }

    let actionWrap = ratingsBottom.querySelector('.tm-archive-action-wrap')
    if (!actionWrap) {
      actionWrap = document.createElement('span')
      actionWrap.className = 'tm-archive-action-wrap'
      ratingsBottom.appendChild(actionWrap)
    }

    button = document.createElement('button')
    button.type = 'button'
    button.className = 'tm-archive-btn'
    button.dataset.tmArchiveBtn = '1'
    actionWrap.appendChild(button)

    return button
  }

  function updateArchiveCardState(card) {
    const videoId = getVideoIdFromCard(card)
    if (!videoId) {
      return
    }

    const isArchived = isVideoPersistedArchived(videoId)
    card.classList.toggle('tm-archived-hidden', hideArchivedVideos && isArchived)

    const button = ensureArchiveButton(card)
    if (!button) {
      return
    }

    if (button.dataset.tmVideoId !== videoId) {
      button.dataset.tmVideoId = videoId
    }

    if (isArchived) {
      setArchiveButtonState(
        button,
        'unarchive',
        'Unarchive',
        'Remove archive mark',
      )
    } else {
      setArchiveButtonState(button, 'archive', 'Archive', 'Archive this video')
    }
  }

  function refreshArchiveUi() {
    const cards = document.querySelectorAll('a.video-card[href]')
    cards.forEach((card) => {
      updateArchiveCardState(card)
    })
  }

  function setupArchiveActions() {
    if (!document.body || document.body.dataset.archiveActionsBound === '1') {
      return
    }

    document.body.dataset.archiveActionsBound = '1'

    document.addEventListener(
      'click',
      (e) => {
        const target = e.target
        if (!(target instanceof Element)) {
          return
        }

        const button = target.closest('button.tm-archive-btn')
        if (!button) {
          return
        }

        const card = button.closest('a.video-card[href]')
        if (!card) {
          return
        }

        e.preventDefault()
        e.stopPropagation()

        const videoId = button.dataset.tmVideoId || getVideoIdFromCard(card)
        if (!videoId) {
          return
        }

        const action = button.dataset.tmArchiveAction || 'archive'

        if (action === 'archive') {
          setVideoPersistedArchived(videoId, true)
        } else {
          setVideoPersistedArchived(videoId, false)
        }

        refreshArchiveUi()
      },
      true,
    )
  }

  function disableVideoCardHoverLift() {
    if (
      !document.head ||
      document.getElementById('tm-disable-video-card-hover-lift')
    ) {
      return
    }

    const style = document.createElement('style')
    style.id = 'tm-disable-video-card-hover-lift'
    style.textContent = `
      .video-card:hover {
        transform: none !important;
      }
      .video-card:hover .poster-image,
      .video-card:hover .poster-image img {
        transform: none !important;
        filter: none !important;
      }
      .video-card .poster-image,
      .video-card .poster-image img {
        transition: none !important;
      }
    `
    document.head.appendChild(style)
  }

  function setupKeyboardShortcuts() {
    if (!document.body || document.body.dataset.shortcutBound === '1') {
      return
    }

    document.body.dataset.shortcutBound = '1'

    const getSearchInput = () =>
      document.querySelector(
        'input[placeholder*="关键词"], input[placeholder*="搜索"]',
      )

    const isSearchOpen = () =>
      !!(document.querySelector('.search-overlay') || getSearchInput())

    const closeSearch = () => {
      const closeBtn =
        document.querySelector('.search-overlay .search-close') ||
        document
          .querySelector('.search-overlay .arco-icon-close')
          ?.closest('.search-close')

      if (closeBtn instanceof HTMLElement) {
        closeBtn.click()
        return true
      }

      return false
    }

    document.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase()
      const isCmdK = e.metaKey && !e.ctrlKey && !e.altKey && key === 'k'
      const isEsc = key === 'escape'

      if (isEsc && isSearchOpen()) {
        e.preventDefault()
        closeSearch()
        return
      }

      if (isCmdK) {
        e.preventDefault()

        if (isSearchOpen()) {
          closeSearch()
          return
        }

        const searchTrigger =
          document.querySelector('.search-trigger') ||
          document
            .querySelector('.arco-icon-search')
            ?.closest('.search-trigger')
        if (searchTrigger instanceof HTMLElement) {
          searchTrigger.click()

          setTimeout(() => {
            const openedInput = getSearchInput()
            if (openedInput instanceof HTMLElement) {
              openedInput.focus()
            }
          }, 0)
        }

        return
      }

      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) {
        return
      }

      const target = e.target
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }

      if (!/^[1-5]$/.test(key)) {
        return
      }

      e.preventDefault()

      if (window.location.pathname === '/') {
        const navLink = Array.from(document.querySelectorAll('a[href]')).find(
          (link) => {
            try {
              const url = new URL(link.href, window.location.href)
              return url.pathname === '/' && url.searchParams.get('sc') === key
            } catch {
              return false
            }
          },
        )

        if (navLink) {
          navLink.click()
          return
        }
      }

      window.location.assign(`https://web5.mukaku.com/?sc=${key}`)
    })
  }

  function runAll() {
    disableVideoCardHoverLift()
    ensureArchiveStyles()
    cleanupLegacyArchivedSection()
    ensureArchiveVisibilityToggle()
    setupArchiveActions()
    setupKeyboardShortcuts()
    removeVipRestrictions()
    addCopyButtons()
    ensureDoubanUnknownTags()
    setupDoubanRatingLinks()
    markDoubanTagsClickable()
    refreshArchiveUi()
  }

  const observerConfig = {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style'],
  }
  let observerStarted = false

  function startObserver() {
    if (observerStarted || !document.body) {
      return
    }

    observer.observe(document.body, observerConfig)
    observerStarted = true
  }

  function runAllWithObserverPause() {
    if (!document.body) {
      return
    }

    if (observerStarted) {
      observer.disconnect()
      observerStarted = false
    }

    try {
      runAll()
    } finally {
      startObserver()
    }
  }

  // Use MutationObserver to handle dynamically loaded content
  const observer = new MutationObserver(() => {
    runAllWithObserverPause()
  })

  // Initial attempt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      startObserver()
      runAllWithObserverPause()
    })
  } else {
    startObserver()
    runAllWithObserverPause()
  }
})()
