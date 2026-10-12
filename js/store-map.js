    (function(){
      var configNode=document.getElementById('storeMapConfig');
      var frame=document.getElementById('storeMapFrame');
      var placeholder=document.getElementById('storeMapPlaceholder');
      var shell=document.getElementById('storeMapShell');
      var directionsSlot=document.getElementById('directionsSlot');
      var status=document.getElementById('locationStatus');
      if(!configNode||!frame||!placeholder||!shell||!directionsSlot||!status)return;
      var config={};
      try{config=JSON.parse(configNode.textContent||'{}');}catch(error){config={};}
      function isGoogleMapsUrl(value,pathPrefix){
        if(!value)return false;
        try{
          var url=new URL(value);
          var allowedHosts=['www.google.com','maps.google.com','www.google.co.in','maps.google.co.in'];
          return url.protocol==='https:'&&allowedHosts.indexOf(url.hostname)!==-1&&url.pathname.indexOf(pathPrefix)===0;
        }catch(error){return false;}
      }
      var embedUrl=isGoogleMapsUrl(config.embedUrl,'/maps/')?config.embedUrl:'';
      var directionsUrl=isGoogleMapsUrl(config.directionsUrl,'/maps/dir/')?config.directionsUrl:'';
      var placeId=typeof config.placeId==='string'&&/^[A-Za-z0-9_-]{10,200}$/.test(config.placeId)?config.placeId:'';
      var locationLabel=typeof config.locationLabel==='string'&&config.locationLabel.trim()?config.locationLabel.trim():'Infinite Nutrition';
      if(placeId){
        if(!embedUrl)embedUrl='https://www.google.com/maps?q='+encodeURIComponent('place_id:'+placeId)+'&output=embed';
        if(!directionsUrl)directionsUrl='https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(locationLabel)+'&destination_place_id='+encodeURIComponent(placeId);
      }
      if(embedUrl){
        frame.src=embedUrl;
        frame.hidden=false;
        placeholder.hidden=true;
        shell.dataset.mapState='ready';
      }
      if(directionsUrl){
        directionsSlot.innerHTML='<a class="btn primary" href="'+directionsUrl.replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'" target="_blank" rel="noopener noreferrer">Get directions</a>';
        status.textContent=embedUrl?'Map and directions use the owner-verified Google Maps destination.':'Directions use the owner-verified Google Maps destination; the embedded map is still awaiting configuration.';
      }
    })();
