addEventListener("fetch", event => {
  event.respondWith(handleRequest(event, event.request))
})

/**
 * Fetch and log a request
 * @param {Request} request
 */
async function handleRequest(ctx, request) {
  const cache = caches.default;
	let response = await cache.match(request);

  if (response){
    return response
  }

  // Parse request URL to get access to query string
  let url = new URL(request.url)
  url.hostname = "cdn-raw.erisa.dev"

  // Cloudflare-specific options are in the cf object.
  let options = { cf: { image: {} } }

  // Copy parameters from query string to request options.
  // You can implement various different parameters here.
  if (url.searchParams.has("fit")) options.cf.image.fit = url.searchParams.get("fit")
  if (url.searchParams.has("width")) options.cf.image.width = url.searchParams.get("width")
  if (url.searchParams.has("height")) options.cf.image.height = url.searchParams.get("height")
  if (url.searchParams.has("quality")) options.cf.image.quality = url.searchParams.get("quality")
  if (url.searchParams.has("format")) options.cf.image.format = url.searchParams.get("format")
  if (url.searchParams.has("rotate")) options.cf.image.rotate = url.searchParams.get("rotate")
  if (url.searchParams.has("sharpen")) options.cf.image.sharpen = url.searchParams.get("sharpen")
  if (url.searchParams.has("blur")) options.cf.image.blur = url.searchParams.get("blur")
  if (url.searchParams.has("dpr")) options.cf.image.dpr = url.searchParams.get("dpr")
  if (url.searchParams.has("gravity")) options.cf.image.gravity = url.searchParams.get("gravity")
  if (url.searchParams.has("trim")) options.cf.image.trim = url.searchParams.get("trim")

  if (Object.keys(options.cf.image).length === 0){
    ctx.waitUntil(cache.put(request, await fetch(url, request)));
  }

  // Your Worker is responsible for automatic format negotiation. Check the Accept header.
  const accept = request.headers.get("Accept");
  
  if (!options.cf.image.format){
    if (/image\/avif/.test(accept)) {
      options.cf.image.format = 'avif';
    } else if (/image\/webp/.test(accept)) {
      options.cf.image.format = 'webp';
    }  
  }

  // Get URL of the original (full size) image to resize.
  // You could adjust the URL here, e.g., prefix it with a fixed address of your server,
  // so that user-visible URLs are shorter and cleaner.
  const imageURL = url

  // TODO: Customize validation logic
  const { hostname, pathname } = new URL(imageURL)

  // Optionally, only allow URLs with JPEG, PNG, GIF, or WebP file extensions
  // @see https://developers.cloudflare.com/images/url-format#supported-formats-and-limitations
  if (!/\.(jpe?g|png|gif|webp)$/i.test(pathname)) {
    ctx.waitUntil(cache.put(request, await fetch(url, request)));
    return fetch(url, request)
  }

  // Build a request that passes through request headers
  const imageRequest = new Request(imageURL, {
    headers: request.headers
  })

  ctx.waitUntil(cache.put(request, await fetch(imageRequest, options)));

  // Returning fetch() with resizing options will pass through response with the resized image.
  return fetch(imageRequest, options)
}
