// ==UserScript==
// @name         X.com Analytics Nav Item
// @namespace    https://github.com/Johnson1602/tampermonkey-scripts
// @version      0.0.1
// @description  Adds an Analytics nav item below Premium in the X.com sidebar
// @author       Weiyi Xu
// @license      MIT
// @match        https://x.com/*
// @match        https://twitter.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=x.com
// @grant        none
// @downloadURL  https://github.com/Johnson1602/tampermonkey-scripts/blob/main/add-analytics-nav-item.js
// @updateURL    https://github.com/Johnson1602/tampermonkey-scripts/blob/main/add-analytics-nav-item.js
// ==/UserScript==

;(function () {
  'use strict'

  const ANALYTICS_URL = '/i/account_analytics'
  const ANALYTICS_LABEL = 'Analytics'

  // Analytics chart icon SVG path
  const ANALYTICS_ICON_PATH =
    'M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z'

  function createAnalyticsNavItem(premiumItem) {
    const analyticsItem = document.createElement('a')
    analyticsItem.href = ANALYTICS_URL
    analyticsItem.setAttribute('aria-label', ANALYTICS_LABEL)
    analyticsItem.setAttribute('role', 'link')
    analyticsItem.className = premiumItem.className
    analyticsItem.setAttribute('data-testid', 'AppTabBar_Analytics_Link')

    // Clone the inner structure from premium item
    const innerDiv = premiumItem.querySelector('div')
    if (innerDiv) {
      const clonedDiv = innerDiv.cloneNode(true)

      // Update the SVG icon
      const svg = clonedDiv.querySelector('svg')
      if (svg) {
        svg.innerHTML = `<g><path d="${ANALYTICS_ICON_PATH}"></path></g>`
      }

      // Update the text
      const textSpans = clonedDiv.querySelectorAll('span')
      if (textSpans.length > 0) {
        textSpans[0].textContent = ANALYTICS_LABEL
      }

      // Add hover state handlers using inline styles
      analyticsItem.addEventListener('mouseenter', () => {
        const isDarkMode = document.documentElement.dataset.theme === 'dark'
        clonedDiv.style.backgroundColor = isDarkMode
          ? 'rgba(231, 233, 234, 0.1)'
          : 'rgba(15, 20, 25, 0.1)'
      })
      analyticsItem.addEventListener('mouseleave', () => {
        clonedDiv.style.backgroundColor = ''
      })

      analyticsItem.appendChild(clonedDiv)
    }

    return analyticsItem
  }

  function addAnalyticsNavItem() {
    // Check if already added
    if (document.querySelector('[data-testid="AppTabBar_Analytics_Link"]')) {
      return
    }

    // Find the Premium nav item, fallback to Home
    const premiumItem = document.querySelector(
      '[data-testid="premium-hub-tab"]'
    )
    const homeItem = document.querySelector(
      '[data-testid="AppTabBar_Home_Link"]'
    )
    const referenceItem = premiumItem || homeItem

    if (!referenceItem) {
      return
    }

    // Create and insert the Analytics nav item
    const analyticsItem = createAnalyticsNavItem(referenceItem)
    referenceItem.insertAdjacentElement('afterend', analyticsItem)
  }

  // Use MutationObserver to handle SPA navigation
  const observer = new MutationObserver((mutations) => {
    addAnalyticsNavItem()
  })

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  })

  // Initial attempt
  addAnalyticsNavItem()
})()
