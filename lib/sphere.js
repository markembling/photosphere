// Google Photosphere
// originally built by @kennydude
// modified by @markembling

// Thanks to three.js example and http://stackoverflow.com/questions/1578169/how-can-i-read-xmp-data-from-a-jpg-with-php

// Usage: new Photosphere("image.jpg").loadPhotosphere(document.getElementById("myPhotosphereID"));
// myPhotosphereID must have width/height specified!


function Photosphere(image){
	this.image = image;
}

Photosphere.prototype.loadPhotosphere = function(holder){
	holder.innerHTML = "wait...";
	
	this.holder = holder;
	if(this.canUseCanvas()){
		self = this;
		this.loadEXIF(function(){
			self.cropImage();
		});
	} else{
		// this is the ugly scroll backup.
		// for silly people on a really old browser!
		holder.innerHTML = "<div style='width:100%;height:100%;overflow-x:scroll;overflow-y:hidden'><div style='margin: 10px; background: #ddd; opacity: 0.6; width: 300px; height: 20px; padding: 4px; position: relative'>If you upgrade to a better browser this is 3D!</div><img style='height:100%;margin-top: -48px' src='"+this.image+"' /></div>";
	}
};

Photosphere.prototype.canUseCanvas = function() {
	// return false; // debugging! i don't have a non-supporting browser :$
	// https://github.com/Modernizr/Modernizr/blob/master/feature-detects/canvas.js
	var elem = document.createElement('canvas');
 	return !!(elem.getContext && elem.getContext('2d'));
};

Photosphere.prototype.cropImage = function(){
	/*
	img = new Image();
	self = this;

	img.onload = function(){
		canvas = document.createElement('canvas');
		canvas.width = self.exif['crop_width'];
		canvas.height = self.exif['crop_height'];
		context = canvas.getContext("2d");
			
		context.fillStyle = "#000";
		context.fillRect(0, 0, canvas.width, canvas.height);
		context.drawImage(img, 0, 0, self.exif['crop_width'], self.exif['crop_height']);
		
		self.start3D( canvas.toDataURL("image/png") );
	}
	img.src = this.image;
	*/
	
	// this is faster
	this.start3D( this.image );
};

Photosphere.prototype.canDoWebGL = function(){
	// Modified mini-Modernizr
	// https://github.com/Modernizr/Modernizr/blob/master/feature-detects/webgl-extensions.js
	var canvas, ctx, exts;

	try {
		canvas  = document.createElement('canvas');
		ctx     = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
		exts    = ctx.getSupportedExtensions();
	}
	catch (e) {
		return false;
	}

	if (ctx === undefined) {
		return false;
	}
	else {
		return true;
	}
};

Photosphere.prototype.start3D = function(image){
	if(window['THREE'] == undefined){ alert("Please make sure three.js is loaded"); }
	
	// Start Three.JS rendering
	this.target = new THREE.Vector3();
	this.lat = 0; this.lon = 0;
	this.onMouseDownMouseX = 0, this.onMouseDownMouseY = 0, this.isUserInteracting = false, this.onMouseDownLon = 0, this.onMouseDownLat = 0;

	// fov should be an angle representing the chunk of image which fits in the width of the thing. It's weirdly inverted - the *wider* the viewer (in relation to height),
	// the smaller this should be. This here isn't perfect, but it stops some strange distortion.
	var fov = 100 / (Math.max(parseInt(this.holder.offsetWidth),parseInt(this.holder.offsetHeight)) / Math.min(parseInt(this.holder.offsetWidth),parseInt(this.holder.offsetHeight)));
	this.baseFov = fov;  // save this as our 'base' fov - to base zooming around
	this.camera = new THREE.PerspectiveCamera(fov, parseInt(this.holder.offsetWidth) / parseInt(this.holder.offsetHeight), 1, 1100 );
	
	this.scene = new THREE.Scene();
	
	// ---
	// Work out what segment of the sphere we have in the image
	var tex = this.loadTexture( image );
	var phiOffset = /*this.exif.x / this.exif.full_width * (Math.PI * 2); // */ 0;
	var thetaOffset = this.exif['y'] / this.exif['full_width'] * (Math.PI * 2); 
	
	var phiLength = (this.exif.crop_width / this.exif.full_width) * (Math.PI * 2);
	var thetaLength = (this.exif.crop_height / this.exif.full_height) * Math.PI;
	
	console.log('philength: '+ phiLength);
	console.log('thetaLength: '+ thetaLength);
	
	// Work out what the sensible starting lat/long is (middle of the actual image)
	this.lon = (this.exif.crop_width / 2) / this.exif.full_width * 360;
	this.lat = -((180 * ( this.exif['y'] + (this.exif['crop_height']) / 2) / this.exif['full_height']) - 90);
	this.centerPoint = { lat: this.lat };  // this is the point we will consider the "middle" (the start point)
	//---
	mesh = new THREE.Mesh( new THREE.SphereGeometry( 200, 20, 40 , phiOffset,phiLength,thetaOffset,thetaLength  ), tex);
	mesh.scale.x = - 1;
	this.scene.add( mesh );
	
	// Check for WebGL
	console.log(this.canDoWebGL());
	if(this.canDoWebGL()){
		// This is for nice browsers + computers
		this.renderer = new THREE.WebGLRenderer();
	} else{
		this.renderer = new THREE.CanvasRenderer();
	}
	
	this.renderer.setSize( parseInt(this.holder.offsetWidth), parseInt(this.holder.offsetHeight) );
	this.holder.innerHTML = "";
	this.holder.appendChild( this.renderer.domElement );

	self = this;
	this.holder.addEventListener( 'touchstart', function(event){ self.onDocumentTouchStart(event, self); }, false );
	this.holder.addEventListener( 'touchmove', function(event){ self.onDocumentTouchMove(event, self); }, false );
	this.holder.addEventListener( 'mousedown', function(event){self.onDocumentMouseDown(event, self); }, false );
	this.holder.addEventListener( 'mousewheel', function(event){self.onMouseWheel(event, self); }, false );	

	document.addEventListener( 'mousemove', function(event){self.onDocumentMouseMove(event, self); }, false );
	document.addEventListener( 'mouseup', function(event){self.onDocumentMouseUp(event, self); }, false );

	this.resetTimer(this, 3000);
};

Photosphere.prototype.startMoving = function(){
	self = this;
	this.interval = setInterval(function(){
		self.lon = self.lon + 0.1;
		
		if( self.centerPoint.lat-3 < self.lat && self.lat < self.centerPoint.lat+3){} 		// basically in the middle - leave alone
		else if(self.lat > self.centerPoint.lat+10){ self.lat -= 0.1 }						// we're looking up - move down
		else if(self.lat > self.centerPoint.lat){ self.lat -= 0.04; }						// we're looking up a bit - move down a bit
		else if(self.lat < self.centerPoint.lat && self.lat > self.centerPoint.lat+10) { self.lat += 0.1; }		// we're looking down - move up
		else if(self.lat < self.centerPoint.lat) { self.lat += 0.04;  }						// we're looking down a bit - move up a bit

		self.render();
	}, 25);
};

Photosphere.prototype.resetTimer = function(self, t){
	if(self.timer != undefined){ clearTimeout(self.timer); }
	if(self.interval != undefined){ clearInterval(self.interval); }

	self.timer = setTimeout(function(){
		self.startMoving();
	}, t);
};

Photosphere.prototype.onWindowResize = function(self) {

	self.camera.aspect = parseInt(self.holder.offsetWidth) / parseInt(self.holder.offsetHeight);
	self.camera.updateProjectionMatrix();

	self.renderer.setSize( parseInt(self.holder.offsetWidth), parseInt(self.holder.offsetHeight) );

	self.render();

}


Photosphere.prototype.onMouseWheel = function( event, self ) {

	proposed = self.camera.fov - event.wheelDeltaY * 0.05;
	
	var minimumFov = 20; // furthest in zoom level we'll allow
	var maximumFov = this.baseFov + 10; // futhest out zoom we'll allow
	
	if(proposed >= minimumFov && proposed <= maximumFov){
		self.camera.fov = proposed;
		self.camera.updateProjectionMatrix();

		self.render();

		event.preventDefault();
	}

}

Photosphere.prototype.onDocumentMouseDown = function( event, self ) {

	event.preventDefault();

	self.isUserInteracting = true;

	self.onPointerDownPointerX = event.clientX;
	self.onPointerDownPointerY = event.clientY;

	self.onPointerDownLon = self.lon;
	self.onPointerDownLat = self.lat;

};

Photosphere.prototype.onDocumentMouseMove = function( event, self ) {

	if ( self.isUserInteracting ) {

		self.lon = ( self.onPointerDownPointerX - event.clientX ) * 0.1 + self.onPointerDownLon;
		self.lat = ( event.clientY - self.onPointerDownPointerY ) * 0.1 + self.onPointerDownLat;
		self.render();

		self.resetTimer(self, 9000);

	}

};

Photosphere.prototype.onDocumentTouchStart = function( event, self ) {

	if ( event.touches.length == 1 ) {

		event.preventDefault();

		self.onPointerDownPointerX = event.touches[ 0 ].pageX;
		self.onPointerDownPointerY = event.touches[ 0 ].pageY;

		self.onPointerDownLon = lon;
		self.onPointerDownLat = lat;

	}

}

Photosphere.prototype.onDocumentTouchMove = function( event, self ) {

	if ( event.touches.length == 1 ) {

		event.preventDefault();

		self.lon = ( self.onPointerDownPointerX - event.touches[0].pageX ) * 0.1 + self.onPointerDownLon;
		self.lat = ( event.touches[0].pageY - self.onPointerDownPointerY ) * 0.1 + self.onPointerDownLat;

		self.render();
		self.resetTimer(self, 9000);

	}

}

Photosphere.prototype.onDocumentMouseUp = function( event, self ) {

	self.isUserInteracting = false;
	self.render();

};

Photosphere.prototype.loadTexture = function( path ) {
	var texture = new THREE.Texture(  );
	var material = new THREE.MeshBasicMaterial( { map: texture, overdraw: true } );

	var image = new Image();
	self = this;
	image.onload = function () {

		texture.needsUpdate = true;
		material.map.image = this;

		setTimeout(function(){ self.render(); }, 10);
	};
	image.src = path;

	return material;
}

Photosphere.prototype.render = function(){
	// Zero is the 'equator', up to +90 and -90 are the 'poles' (sign is flipped below when lat is calculated)
	// Calculate maximums, accounting for image shape as best as possible.
	var hemisphereHeight = (this.exif['full_height'] / 2);
	var maxNorthLatDegrees = ((hemisphereHeight - this.exif['y']) / hemisphereHeight) * 90;
	var maxSouthLatDegrees = ( ( (this.exif['y'] + this.exif['crop_height']) - hemisphereHeight ) / hemisphereHeight * 90 );
	maxNorthLatDegrees = Math.min(maxNorthLatDegrees, 80);  // going to a full 90 is strange
	maxSouthLatDegrees = Math.min(maxSouthLatDegrees, 80);
	
	this.lat = Math.max( - maxSouthLatDegrees, Math.min( maxNorthLatDegrees, this.lat ) );
	
	
	var minLon = 0; // most left we can go. Always zero since we will start the image there.
	var maxLon = parseInt(this.exif['crop_width']) / parseInt(this.exif['full_width']) * 360;  // most right we can go. Width of image in degrees
	
	// stop at either min or max. Only do it like this if we don't have a full circle
	if (maxLon < 360) {
		var padding = ((this.camera.aspect * this.camera.fov) / 2.5);  // this much stops us spinning an entire vertical hemisphere off
		this.lon = Math.max(minLon + padding, Math.min(maxLon - padding, this.lon));
	}
	// Wrap around to 0 when reaching 360
	else if (this.lon >= 360) 
		this.lon = 0;
	// else this.lon = this.lon - obviously
	
	// Work out where to point the camera
	lambda = ( 90 - this.lat ) * Math.PI / 180;
	phi = this.lon * Math.PI / 180;

	this.target.x = 500 * Math.sin( lambda ) * Math.cos( phi );
	this.target.y = 500 * Math.cos( lambda );
	this.target.z = 500 * Math.sin( lambda ) * Math.sin( phi );

	this.camera.lookAt( this.target );

	this.renderer.render( this.scene, this.camera );
};

Photosphere.prototype.loadBinary = function(callback){
	if(this.binary_data != undefined){ callback(this.binary_data); return; }
	var oHTTP = null;
	if (window.ActiveXObject) {
		oHTTP = new ActiveXObject("Microsoft.XMLHTTP");
	} else if (window.XMLHttpRequest) {
		oHTTP = new XMLHttpRequest();
	}
	
	if (typeof(oHTTP.onload) != "undefined") {
		oHTTP.onload = function() {
			if (oHTTP.status == "200") {
				callback(oHTTP.responseText);
			} else {
				// Error?
			}
			oHTTP = null;
		};
	} else {
		oHTTP.onreadystatechange = function() {
			if (oHTTP.readyState == 4) {
				if (oHTTP.status == "200") {
					callback(oHTTP.responseText);
				} else {
					// Error?
				}
				oHTTP = null;
			}
		};
	}
	oHTTP.open("GET", this.image, true);
	oHTTP.send(null);
};

Photosphere.prototype.setEXIF = function(data){
	this.exif = data;
	return this;
};

Photosphere.prototype.loadEXIF = function(callback){
	if(this.exif != undefined){ callback(); return; }
	self = this;
	this.loadBinary(function(data){
		xmpEnd = "</x:xmpmeta>";
		xmpp = data.substring(data.indexOf("<x:xmpmeta"), data.indexOf(xmpEnd) + xmpEnd.length);

		getAttr = function(attr){
			x = xmpp.indexOf(attr+'="') + attr.length + 2;
			return xmpp.substring( x, xmpp.indexOf('"', x) );
		};

		self.exif = {
			"full_width" : parseInt(getAttr("GPano:FullPanoWidthPixels")),
			"full_height" : parseInt(getAttr("GPano:FullPanoHeightPixels")),
			"crop_width" : parseInt(getAttr("GPano:CroppedAreaImageWidthPixels")),
			"crop_height" : parseInt(getAttr("GPano:CroppedAreaImageHeightPixels")),
			"x" : parseInt(getAttr("GPano:CroppedAreaLeftPixels")),
			"y" : parseInt(getAttr("GPano:CroppedAreaTopPixels"))
		}
		console.log(self.exif);
		callback();
	});
};
