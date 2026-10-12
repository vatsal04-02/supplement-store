/*
  Store map: stays an honest empty state until the owner supplies a verified
  Google Maps embed URL, directions URL or Place ID in js/site-config.js.
*/
(function () {
  'use strict';
  var frame = document.getElementById('storeMapFrame');
  var placeholder = document.getElementById('storeMapPlaceholder');
  var shell = document.getElementById('storeMapShell');
  var directionsSlot = document.getElementById('directionsSlot');
  var status = document.getElementById('locationStatus');
  if (!frame || !placeholder || !shell || !directionsSlot || !status) return;

  var config = (window.INFINITE_SITE && window.INFINITE_SITE.map) || {};

  function isGoogleMapsUrl(value, pathPrefix) {
    if (typeof value !== 'string' || !value) return false;
    try {
      var url = new URL(value);
      var allowedHosts = ['www.google.com', 'maps.google.com', 'www.google.co.in', 'maps.google.co.in'];
      return url.protocol === 'https:' && allowedHosts.indexOf(url.hostname) !== -1 && url.pathname.indexOf(pathPrefix) === 0;
    } catch (error) {
      return false;
    }
  }

  var embedUrl = isGoogleMapsUrl(config.embedUrl, '/maps/') ? config.embedUrl : '';
  var directionsUrl = isGoogleMapsUrl(config.directionsUrl, '/maps/dir/') ? config.directionsUrl : '';
  var placeId = typeof config.placeId === 'string' && /^[A-Za-z0-9_-]{10,200}$/.test(config.placeId) ? config.placeId : '';
  var locationLabel = typeof config.locationLabel === 'string' && config.locationLabel.trim() ? config.locationLabel.trim() : 'Infinite Nutrition';

  if (placeId) {
    if (!embedUrl) embedUrl = 'https://www.google.com/maps?q=' + encodeURIComponent('place_id:' + placeId) + '&output=embed';
    if (!directionsUrl) directionsUrl = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(locationLabel) + '&destination_place_id=' + encodeURIComponent(placeId);
  }

  if (embedUrl) {
    frame.src = embedUrl;
    frame.hidden = false;
    placeholder.hidden = true;
    shell.dataset.mapState = 'ready';
  }

  if (directionsUrl) {
    var link = document.createElement('a');
    link.className = 'btn primary';
    link.href = directionsUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.dataset.directions = '';
    link.textContent = 'Get directions';
    directionsSlot.replaceChildren(link);
    status.textContent = embedUrl
      ? 'Map and directions use the owner-verified Google Maps destination.'
      : 'Directions use the owner-verified Google Maps destination; the embedded map is still awaiting configuration.';
  }
})();
