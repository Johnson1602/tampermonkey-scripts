// ==UserScript==
// @name         Remove VIP Blur
// @namespace    https://github.com/Johnson1602/tampermonkey-scripts
// @version      0.0.3
// @description  Removes VIP paywall blur and overlay, adds copy button for magnet links
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

  function removeVipRestrictions() {
    // Remove the VIP gate overlay
    const overlay = document.querySelector('.vip-gate-overlay')
    if (overlay) {
      overlay.remove()
    }

    // Find elements with blur/pointer-events/user-select restrictions and remove them
    const blurredElements = document.querySelectorAll(
      '[style*="blur"], [style*="pointer-events: none"], [style*="user-select: none"]'
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
      true
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

  function runAll() {
    removeVipRestrictions()
    addCopyButtons()
    setupDoubanRatingLinks()
    markDoubanTagsClickable()
  }

  // Use MutationObserver to handle dynamically loaded content
  const observer = new MutationObserver(() => {
    runAll()
  })

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style'],
  })

  // Initial attempt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runAll)
  } else {
    runAll()
  }
})()
