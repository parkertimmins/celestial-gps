# celestial-gps

This is a webapp which can be used on a smart phone to find your location on earth by taking sightings of the moon or sun. It requires permissions for your camera and phone orientation.

Run locally
* `npm run start:dev`

Build 
* `npm run build`

Build and deploy to Github pages:
* `npm run deploy`



Local Debug Android
* Enable developer mode on phone
* Turn on USB debugging in settings
* Plug phone into computer usb
* Open Android System alert for usb options
    * Select PTP usb option
* Navigate in Chrome to chrome://inspect/#devices
* Open Port Fowarding
    * Add mapping from 8080 to localhost:8080 (only have to do once)
* Open chrome browser on phone
* From computer chrome device inspect page
    * Enter http://localhost:8080/celestial-gps/index.html into "Open tab with url" box and click open
    * Click inspect on new url to watch debug logs while interacting on phone
