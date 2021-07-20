
import React from 'react';
import 'leaflet/dist/leaflet.css';
import 'leaflet/dist/images/layers-2x.png';
import 'leaflet/dist/images/layers.png';
import 'leaflet/dist/images/marker-icon-2x.png';
import 'leaflet/dist/images/marker-icon.png';
import 'leaflet/dist/images/marker-shadow.png';


import { Map, Marker, Popup, TileLayer, GeoJSON } from 'react-leaflet'
import { julianCenturies, toJulian } from './js/julian';
import { Moon } from './js/moon';
import { sunComputeLocation, moonComputeLocation, computeAltAzFromQuat, computeAltAzFromABG, toRegLatLong, MAGNETIC_NP } from './js/celestial';


class App extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            needUserPermission: true,
            cameraVisible: true,
            estimatedLocations: [],
            celestialLocation: null
        };
	    this.altAz = null;

        this.toggleCameraMap = this.toggleCameraMap.bind(this);
        this.findByMoon = this.findByMoon.bind(this);
        this.findBySun = this.findBySun.bind(this);
    }

    findBySun() {
        console.log("Altitude/Azimuth", this.altAz);
		this.addLatLong(sunComputeLocation(this.altAz, Date.now()));
    }

    findByMoon() {
        console.log("Altitude/Azimuth", this.altAz);
		this.addLatLong(moonComputeLocation(this.altAz, Date.now()));
    }

    addLatLong(reading) {
        // failed reading
        if (Object.keys(reading).length === 0) {
            return;
        }

		const hereLatLong = markerLatLong(reading.here); 
        console.log("Adding position", reading.here); 
        this.setState(prevState => ({
            estimatedLocations: [...prevState.estimatedLocations, hereLatLong]
        }))
        this.setState({ celestialLocation: markerLatLong(reading.celestial) })
    }

    

    toggleCameraMap() {
        this.setState({ cameraVisible: !this.state.cameraVisible })
    }

    isIOS() {
        return /(iPad|iPhone|iPod)/g.test(navigator.userAgent);

    }

    givePermission() {
        this.setState({ needUserPermission: false })

        if (this.isIOS()) {
            this.startIphoneOrientationSensor();
        } else {
            this.startAndroidOrientationSensor();
        }
    }

    startAndroidOrientationSensor() {
        console.log("Initializing sensor for Android");
        const sensor = new window.AbsoluteOrientationSensor({frequency: 60, referenceFrame: 'device' })
        sensor.start();
        // constantly update altitude and azimuth in global state
        sensor.addEventListener('reading', () => {
            this.altAz = computeAltAzFromQuat(sensor.quaternion)    
        });
    }

    startIphoneOrientationSensor() {
        console.log("Initializing sensor for iPhone");
        
        // feature detect
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(permissionState => {
                    if (permissionState === 'granted') {
                        window.addEventListener('deviceorientation', () => {
                            this.altAz = computeAltAzFromABG(event.alpha, event.beta, event.gamma, event.webkitCompassHeading);
                        });
                    }
                })
                .catch(console.error);
        } else {
            alert("DeviceOrientation not available");
          // handle regular non iOS 13+ devices
        }
    }


    render() {
        if (this.state.needUserPermission) {
            return <RequestPermsModal givePermission={() => this.givePermission()} />
        } 
      
        return ( 
            <>
                <Tab hidden={!this.state.cameraVisible}>          
                    <CameraView toggleCameraMap={this.toggleCameraMap} findByMoon={this.findByMoon} findBySun={this.findBySun} /> 
                </Tab>
                
                <Tab hidden={this.state.cameraVisible}>
                    <MapView toggleCameraMap={this.toggleCameraMap} estimatedLocations={this.state.estimatedLocations} celestialLocation={this.state.celestialLocation}/> 
                </Tab>
            </>
        );
    }
}

function markerLatLong(latLongWest) {
    const { lat, long } = toRegLatLong(latLongWest);
    console.log('markerLatLong', lat, long)
    return [lat, long].map(n => n.toFixed(4))
}

function Tab(props) {
  return (
    <div className={props.hidden ? 'hidden' : ''}>
        {props.children}
    </div>
  );
}

function RequestPermsModal(props) {
    return (
        <div id="request-perms-modal">
            <div id="modal-content">
                <button id="request-perms" onClick={props.givePermission}>Allow orientation sensor</button>
            </div> 
        </div> 
    );
}

class MapView extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            countries: null,
            states: null,
            cities: null
        }
        this.mapRef = React.createRef();
    }

    componentDidMount() {
        this.getGeoJSON();
    }

    componentDidUpdate() {
        this.mapRef.current.leafletElement.invalidateSize()
    }

    fetchJSON(url) {
        return fetch(url).then(response => response.json());
    }

    getGeoJSON() {
        this.fetchJSON('./natural-earth-data/ne_50m_admin_0_sovereignty.geojson')
            .then(data => this.setState({ countries: data }));
            //.then(data => L.geoJSON(data, {color: 'green'}).addTo(map))
        
        this.fetchJSON('./natural-earth-data/ne_50m_admin_1_states_provinces_lines.geojson')
            .then(data => this.setState({ states: data }));
            //.then(data => L.geoJSON(data, {color: 'green'}).addTo(map))

        this.fetchJSON('./natural-earth-data/ne_50m_populated_places_simple.geojson')
            .then(data => this.setState({ cities: data }));
            //.then(data => L.geoJSON(data, { 
             //   pointToLayer: (geoJsonPoint, latlng) => L.circle(latlng, {radius: 10000, color: 'green'})
            //}).addTo(map))
    }

    render() {
        const markers = this.props.estimatedLocations.map((position, idx) => <LocationMarker keyValue={`marker-${idx}`} position={position} label={"Estimated Location"} />)
        const celestialMarker = this.props.celestialLocation ? <LocationMarker keyValue={`celestial-marker`} position={this.props.celestialLocation} label={"Celestial Object"}/> : null;
        const magneticPoleMarker = <LocationMarker keyValue={`mag-pole-marker`} position={markerLatLong(MAGNETIC_NP)} label={"Magnetic North Pole"} />;
        
        const locations = this.props.estimatedLocations;
        const center = locations.length ? locations[locations.length - 1] :  [24.944292, 0.202651]; // center of world map
        const zoom = locations.length ? 5 : 2; // zoom in on new pin 
        
        return (
            <div>
                <div className="top-row control-row">
                    <button type="button" className="round-button" title="Go to Camera view" onClick={this.props.toggleCameraMap}>📷</button>
                </div>
                <div id="map-pane"> 
                    <Map ref={this.mapRef} center={center} zoom={zoom}>
                        {this.state.countries && <GeoJSON key="countries" data={this.state.countries} />}
                        {this.state.states && <GeoJSON key="states" data={this.state.states} />}
                        {markers}
                        {celestialMarker}
                        {magneticPoleMarker}
                    </Map>
                </div>
            </div>
        );
    }
    
}

function LocationMarker({ keyValue, position, label}) {
    return <Marker key={keyValue} position={position}>
                <Popup closeOnClick={false} autoClose={false}>
                    <span>{label}: {position[0]}, {position[1]}</span>
                </Popup>
            </Marker>
}


class CameraView extends React.Component {
    constructor(props) {
        super(props);
        
        this.cameras = [];
        this.selectedCameraIdx = 0;
    
        this.addVideoDevicesToCameraList = this.addVideoDevicesToCameraList.bind(this);
        this.setSelectedStream = this.setSelectedStream.bind(this);
        this.setCanvasToVideo = this.setCanvasToVideo.bind(this);
        this.copyVideoToCanvas = this.copyVideoToCanvas.bind(this);
        this.switchCamera = this.switchCamera.bind(this);

        this.videoRef = React.createRef();
        this.canvasRef = React.createRef();
    }

    switchCamera() {
        this.selectedCameraIdx = (this.selectedCameraIdx + 1) % this.cameras.length;
        this.setVideoToSelectedStream();
    }

    addVideoDevicesToCameraList(deviceInfos) {
        for (let deviceInfo of deviceInfos) {
            if (deviceInfo.kind === 'videoinput') {
                this.cameras.push(deviceInfo);

                // use this camera if is back camera
                if (deviceInfo.label && deviceInfo.label.toLowerCase().includes("back")) {
                    this.selectedCameraIdx = this.cameras.length - 1;
                }
            }
        }
    }
   
    componentDidMount() {
        this.initVideo();
    } 

    hasGetUserMedia() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }

    initVideo() {
        if (!this.hasGetUserMedia()) {
            alert('getUserMedia() is not supported by your browser');
            return;
        }

        navigator.mediaDevices
            .enumerateDevices()
            .then(this.addVideoDevicesToCameraList)
            .then(this.setSelectedStream) // ????
    }

    setSelectedStream() {
        this.setVideoToSelectedStream()
        this.setCanvasToVideo();
    }
    
    setVideoToSelectedStream() {
        if (window.stream) {
            window.stream.getTracks().forEach(track => track.stop())
        }

        const deviceId = this.cameras[this.selectedCameraIdx].deviceId
        console.log("Selected camera with deviceId", deviceId) 
        const constraints = { video: { deviceId } };

        return navigator.mediaDevices
            .getUserMedia(constraints)
            .then(stream => {
                window.stream = stream; // make stream available to console
                this.videoRef.current.srcObject = stream;
            })
    }

    setCanvasToVideo() {
        this.copyVideoToCanvas();
        setTimeout(this.setCanvasToVideo, 10);
    }

    copyVideoToCanvas() {
        const canvas = this.canvasRef.current;
        const video = this.videoRef.current;
        
        // should probably not do every frame ¯\_(ツ)_/¯
        this.setCanvasDimensions();
        
        if (canvas.width === 0 || canvas.height === 0) {
            return;
        }
    
        const ctx = canvas.getContext("2d");
        
        // first copy frame from video element to canvas
        ctx.drawImage(video, 0, 0);

        ctx.strokeStyle = "white";
        ctx.lineWidth = 1 
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        
        ctx.moveTo(canvas.width / 2, 0);
        ctx.lineTo(canvas.width / 2, canvas.height);
        ctx.stroke();	
    }

    // sets logically pixel width of canvas, not size of html element, hence works with width: 100% 
    setCanvasDimensions() {
        const canvas = this.canvasRef.current;
        const video = this.videoRef.current;
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
    }

    render() {
        return (
            <div>
                <div className="top-row control-row">
                    <button  className="round-button" title="Go to Map view" onClick={this.props.toggleCameraMap}>🌎</button>
                </div>
                
                <div id="camera-image" className="fullscreen-pane"> 
                    <video ref={this.videoRef} autoPlay playsInline></video>
                    <canvas ref={this.canvasRef} id="canvas1"></canvas>
                </div>
                        
                <div className="bottom-row control-row"> 
                    <button onClick={this.switchCamera} type="button" className="round-button">🔄</button>
                    <button onClick={this.props.findByMoon} type="button" className="round-button" title="Find location by Moon">🌘</button>
                    <button onClick={this.props.findBySun} type="button" className="round-button" title="Find location by Sun">☀️ </button>
                </div>
            </div>
        );
    }
}

export default App;

