import { chromium } from 'playwright' // Import Playwright's Chromium browser engine
import 'dotenv/config' // Load environment variables from .env file
import fs from 'fs' // Import Node.js file system module for reading/writing files
import path from 'path' // Import Node.js path module for handling file paths

// Function to parse command line arguments into a key-value object
function parseArgs(argv) {
  const args = {} // Initialize empty arguments object
  for (let i = 0; i < argv.length; i++) { // Iterate through each argument
    const token = argv[i] // Get the current argument token
    if (token.startsWith('--')) { // Check if it's a flag (starts with --)
      const eq = token.indexOf('=') // Check if it has an equals sign (e.g., --key=value)
      if (eq !== -1) { // If it has an equals sign
        const k = token.slice(2, eq) // Extract key (remove --)
        const v = token.slice(eq + 1) // Extract value
        args[k] = v // Store in args object
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) { // If next arg is a value (e.g., --key value)
        args[token.slice(2)] = argv[i + 1] // Store key and next arg as value
        i++ // Skip next argument since we used it
      } else { // It's a boolean flag (e.g., --flag)
        args[token.slice(2)] = true // Set to true
      }
    }
  }
  return args // Return the parsed arguments
}

// Function to pause execution and wait for user to press Enter
async function waitForEnter(prompt) {
  process.stdout.write(prompt) // Print the prompt message to console
  await new Promise((resolve) => { // Create a promise that resolves when Enter is pressed
    process.stdin.resume() // Resume standard input stream
    process.stdin.once('data', () => { // Listen for data (Enter key) once
      process.stdin.pause() // Pause standard input stream
      resolve() // Resolve the promise to continue execution
    })
  })
}

// Function to ensure a directory exists, creating it if needed
function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }) // Create directory recursively if it doesn't exist
}

// Function to generate a timestamp string for filenames
function timestamp() {
  const d = new Date() // Get current date and time
  const pad = (n) => String(n).padStart(2, '0') // Helper to pad numbers with leading zero
  return (
    d.getFullYear() + // Year
    pad(d.getMonth() + 1) + // Month (0-indexed so add 1)
    pad(d.getDate()) + // Day
    '-' + // Separator
    pad(d.getHours()) + // Hour
    pad(d.getMinutes()) + // Minute
    pad(d.getSeconds()) // Second
  )
}

// Main execution function
async function main() {
  const args = parseArgs(process.argv.slice(2)) // Parse command line args (skipping node and script path)
  const url = args.url || process.env.TARGET_URL // Get target URL from args or env
  const selector = args.selector || process.env.SELECTOR // Get CSS selector from args or env
  const loginUrl = args.loginUrl || process.env.LOGIN_URL // Get login URL from args or env
  // Determine if we should crawl sitemap (default false)
  const crawlSitemap =
    String(args.crawlSitemap !== undefined ? args.crawlSitemap : process.env.CRAWL_SITEMAP || 'false').toLowerCase() === 'true'
  // Determine max products to scrape (default 0 for all)
  const maxProducts =
    args.maxProducts !== undefined
      ? parseInt(String(args.maxProducts), 10) || 0 // Parse from args
      : parseInt(String(process.env.MAX_PRODUCTS || '0'), 10) || 0 // Parse from env
  // Determine if headless mode should be used (default false)
  const headless =
    args.headless !== undefined
      ? String(args.headless).toLowerCase() === 'true' // Parse from args
      : String(process.env.HEADLESS || 'false').toLowerCase() === 'true' // Parse from env

  // Validate required arguments based on mode
  if (!crawlSitemap && (!url || !selector)) {
    console.error('Usage: node scrape.mjs --url <URL> --selector <CSS> [--loginUrl <LOGIN_URL>] [--headless <true|false>] [--crawlSitemap <true|false>] [--maxProducts <N>]')
    process.exit(1) // Exit with error code if validation fails
  }

  // Set up persistent browser profile path
  const profileDir = path.resolve(process.env.BROWSER_PROFILE_DIR || '.browser_profile')
  ensureDir(profileDir) // Create profile directory
  
  // Launch browser with persistent context (saves cookies/login state)
  const context = await chromium.launchPersistentContext(profileDir, { headless })
  const page = await context.newPage() // Open a new page/tab

  try {
    // Handle login flow if URL provided and we're in single-page mode (NOTE: Sitemap mode skips this currently)
    if (!crawlSitemap && loginUrl) {
      await page.goto(loginUrl, { waitUntil: 'domcontentloaded' }) // Navigate to login page
      await waitForEnter('Complete login and any 2FA in the browser, then press Enter here to continue...\n') // Wait for user manual login
    }

    // Branch 1: Sitemap Crawling Mode
    if (crawlSitemap) {
      const base = (url || 'https://thepihut.com').trim() // Get base URL
      const sitemapUrl = (base.replace(/\/+$/, '') + '/sitemap.xml').trim() // Construct sitemap URL
      console.log(`Fetching sitemap from ${sitemapUrl}...`) // Log status
      
      const resp = await page.goto(sitemapUrl, { waitUntil: 'load' }) // Navigate to sitemap
      const xml = await resp.text() // Get XML content
      
      // Extract all <loc> URLs from main sitemap
      const locs = []
      {
        const re = /<loc>([^<]+)<\/loc>/g // Regex to match <loc> tags
        let m
        while ((m = re.exec(xml))) locs.push(m[1]) // Push found URLs
      }
      
      // Find product-specific sitemaps (Shopify structure usually has sitemap_products_1.xml)
      let productSitemaps = locs.filter((l) => l.includes('sitemap_products'))
      if (productSitemaps.length === 0) productSitemaps = locs // Fallback to all locs if no product sitemaps found
      
      const productUrlsSet = new Set() // Use Set to avoid duplicate URLs
      
      // Iterate through each product sitemap
      for (const sm of productSitemaps) {
        const r = await page.goto(sm, { waitUntil: 'load' }) // Visit sub-sitemap
        const x = await r.text() // Get XML content
        
        // Extract product URLs from sub-sitemap
        const urls = []
        const re2 = /<loc>([^<]+)<\/loc>/g
        let m2
        while ((m2 = re2.exec(x))) urls.push(m2[1])
        
        // Filter for URLs containing '/products/'
        for (const u of urls) {
          if (u.includes('/products/')) productUrlsSet.add(u)
        }
      }
      
      // Convert Set to Array and filter empty strings
      const productUrls = Array.from(productUrlsSet).filter(u => u && u.trim() !== '')
      
      // Determine scraping limit
      const limit = maxProducts > 0 ? Math.min(maxProducts, productUrls.length) : productUrls.length
      console.log(`Found ${productUrls.length} products. Scraping ${limit} of them...`)
      
      // Setup output file
      const outDir = path.resolve(process.env.OUTPUT_DIR || 'outputs')
      ensureDir(outDir)
      const file = path.join(outDir, `pihut-${timestamp()}.csv`)
      const header = 'name,sku,price,availability\n' // CSV header
      fs.writeFileSync(file, header) // Write header to new file
      
      const BATCH_SIZE = 10 // Number of concurrent tabs
      
      // Process products in batches
      for (let i = 0; i < limit; i += BATCH_SIZE) {
        const batch = productUrls.slice(i, Math.min(i + BATCH_SIZE, limit)) // Get current batch URLs
        
        // Map batch URLs to scraping promises
        const promises = batch.map(async (u, idx) => {
          if (!u || u.trim() === '') {
             return null // Skip empty URLs
          }
          const p = await context.newPage() // Open new tab for this product
          try {
            // Navigate to product page with 60s timeout
            await p.goto(u, { waitUntil: 'domcontentloaded', timeout: 60000 })
            
            // Extract data from page context
            const info = await p.evaluate(() => {
              // Helper to decode HTML entities (e.g., &quot; -> ")
              function decodeHtml(html) {
                if (!html) return ''
                const txt = document.createElement('textarea')
                txt.innerHTML = html
                return txt.value
              }

              // Helper to parse JSON-LD object for Product data
              function pickProduct(j) {
                const arr = Array.isArray(j) ? j : [j] // Ensure array
                for (const obj of arr) {
                  const types = obj['@type']
                  // Check if type is Product
                  const isProduct = Array.isArray(types) ? types.includes('Product') : types === 'Product'
                  if (isProduct) {
                    const name = decodeHtml(obj.name || '') // Extract and decode name
                    const sku = decodeHtml(obj.sku || '') // Extract and decode SKU
                    let price = ''
                    let availability = ''
                    const offers = obj.offers // Check offers property
                    if (offers) {
                      const offerArr = Array.isArray(offers) ? offers : [offers]
                      if (offerArr.length) {
                        const o = offerArr[0] // Take first offer
                        // Extract price
                        price = o.price || (o.priceSpecification && o.priceSpecification.price) || ''
                        // Extract availability
                        availability = o.availability || ''
                        if (Array.isArray(availability)) availability = availability[0] || ''
                        if (typeof availability === 'object' && availability !== null) availability = availability.name || availability['@id'] || ''
                      }
                    }
                    // Normalize availability string
                    availability = String(availability || '')
                    if (availability.includes('/')) {
                      availability = availability.split('/').pop() // Get last part (e.g., InStock)
                    }
                    return { name, sku, price, availability }
                  }
                }
                return null
              }
              
              // Find all JSON-LD scripts
              const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
                .map((s) => s.textContent)
                .filter(Boolean)
              
              let extracted = null
              // Try to parse each script to find Product data
              for (const s of scripts) {
                try {
                  const j = JSON.parse(s)
                  extracted = pickProduct(j)
                  if (extracted) break // Stop if found
                } catch {}
              }

              // 2. Try Shopify Metadata (Backup if JSON-LD fails)
              // @ts-ignore
              if (!extracted || !extracted.sku) {
                // @ts-ignore
                // Access global Shopify objects
                const sp = window.meta?.product || window.ShopifyAnalytics?.meta?.product
                if (sp && sp.variants && sp.variants.length > 0) {
                  const v = sp.variants[0] // Get first variant
                  // Fallback name logic
                  const name = sp.type && sp.type.includes('Case') ? (v.name || sp.handle) : (v.name || document.title)
                  const finalName = decodeHtml(extracted?.name || name)
                  const sku = decodeHtml(v.sku || '')
                  // Shopify price is usually in cents, convert to decimal
                  const price = v.price ? (v.price / 100).toFixed(2) : ''
                  
                  // Update extracted object
                  if (!extracted) {
                    extracted = { name: finalName, sku, price, availability: '' }
                  } else {
                    if (!extracted.sku) extracted.sku = sku
                    if (!extracted.price) extracted.price = price
                  }
                }
              }

              // Initialize empty object if still null
              if (!extracted) {
                extracted = { name: '', sku: '', price: '', availability: '' }
              }

              // 3. DOM Fallbacks (Scrape visible text if data missing)
              if (!extracted.name) {
                extracted.name = (document.querySelector('h1')?.textContent || '').trim() // H1 title
              }

              if (!extracted.price) {
                // Check various meta tags and classes for price
                const priceMeta = document.querySelector('meta[property="product:price:amount"]')
                const priceItemprop = document.querySelector('[itemprop="price"]')
                let price =
                  (priceMeta && priceMeta.getAttribute('content')) ||
                  (priceItemprop && (priceItemprop.getAttribute('content') || (priceItemprop.textContent || '').trim())) ||
                  ''
                if (!price) {
                  const priceEl =
                    document.querySelector('[itemprop="price"]') ||
                    document.querySelector('.price') ||
                    document.querySelector('.product-price')
                  const raw = priceEl ? (priceEl.textContent || '').trim() : ''
                  const m = raw && raw.match(/(\d+(?:\.\d+)?)/) // Regex for number
                  price = m ? m[1] : raw
                }
                extracted.price = price
              }

              if (!extracted.availability || extracted.availability === '') {
                // Check various classes for stock status
                const availEl =
                  document.querySelector('[data-stock]') ||
                  document.querySelector('.availability') ||
                  document.querySelector('.stock-status') ||
                  document.querySelector('.product-form__inventory')
                
                let text = availEl ? (availEl.textContent || '').trim() : ''
                
                // Regex fallback for availability in body text
                if (!text) {
                  const bodyText = document.body.innerText
                  const stockMatch = bodyText.match(/Stock:\s*([^\n]+)/i) || bodyText.match(/Availability:\s*([^\n]+)/i)
                  if (stockMatch) text = stockMatch[1].trim()
                  
                  // Specific check for "Only X units left" implies InStock
                  if (!text && bodyText.match(/Only \d+ units left/i)) {
                    text = 'InStock'
                  }
                }

                // Normalize text to standard status
                if (text) {
                    if (text.toLowerCase().includes('in stock') || text.includes('units left')) {
                        extracted.availability = 'InStock'
                    } else if (text.toLowerCase().includes('out of stock') || text.toLowerCase().includes('sold out')) {
                        extracted.availability = 'OutOfStock'
                    } else {
                        extracted.availability = text
                    }
                }
                
                // Clean up URL-like availability strings
                if (typeof extracted.availability === 'string' && extracted.availability.includes('/')) {
                  extracted.availability = extracted.availability.split('/').pop()
                }
              }

              if (!extracted.sku) {
                // Check various classes for SKU
                const skuEl =
                  document.querySelector('.sku') ||
                  document.querySelector('[itemprop="sku"]') ||
                  document.querySelector('.product-sku') ||
                  document.querySelector('.variant-sku')
                let sku = skuEl ? (skuEl.textContent || '').trim() : ''
                
                // Regex fallback for SKU
                if (!sku) {
                   const bodyText = document.body.innerText
                   const skuMatch = bodyText.match(/SKU:\s*([^\n]+)/)
                   if (skuMatch) sku = skuMatch[1].trim()
                }
                extracted.sku = sku
              }

              // --- Final Overrides ---
              // Check for Discontinued status in product name
              if (extracted.name && extracted.name.toLowerCase().includes('[discontinued]')) {
                 extracted.availability = 'Discontinued'
              }

              return extracted // Return final data object
            })
            return info
          } catch (e) {
            console.error(`Failed to scrape ${u}: ${e.message}`) // Log error
            return null
          } finally {
            await p.close() // Close tab to free memory
          }
        })
        
        const results = await Promise.all(promises) // Wait for all tabs in batch
        const validResults = results.filter(r => r !== null) // Filter failed scrapes
        
        // Format results as CSV lines
        const lines = validResults.map(info => {
          const esc = (v) => String(v || '').replace(/"/g, '""') // Escape quotes
          return `"${esc(info.name)}","${esc(info.sku)}","${esc(info.price)}","${esc(info.availability)}"`
        })
        
        // Append lines to file immediately
        if (lines.length > 0) {
          fs.appendFileSync(file, lines.join('\n') + '\n')
        }
        console.log(`Processed ${Math.min(i + BATCH_SIZE, limit)}/${limit} products...`) // Log progress
      }
      console.log(`Done! Saved rows to ${file}`)
      
    // Branch 2: Single Page Mode (for testing/specific pages)
    } else {
      await page.goto(url, { waitUntil: 'domcontentloaded' }) // Navigate to URL
      // Extract data using provided selector
      const results = await page.$$eval(selector, (nodes) =>
        nodes.map((n) => {
          const href = n.href || (n.closest('a') ? n.closest('a').href : null) // Get Link
          const text = (n.innerText || n.textContent || '').trim() // Get Text
          return { text, href: href || '' }
        })
      )
      
      // Save results
      const outDir = path.resolve(process.env.OUTPUT_DIR || 'outputs')
      ensureDir(outDir)
      const file = path.join(outDir, `scrape-${timestamp()}.csv`)
      const header = 'text,href\n'
      const lines = results.map((r) => {
        const t = String(r.text).replace(/"/g, '""')
        const h = String(r.href).replace(/"/g, '""')
        return `"${t}","${h}"`
      })
      fs.writeFileSync(file, header + lines.join('\n'))
      console.log(`Saved ${results.length} rows to ${file}`)
    }
  } catch (err) {
    console.error(err && err.message ? err.message : String(err)) // Log fatal errors
    process.exitCode = 1 // Set exit code to error
  } finally {
    await context.close() // Close browser context
  }
}
main() // Run the main function
