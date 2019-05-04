# sumorobot-interface

The SumoInterface resides here
![SumoInterface](https://www.robokoding.com/assets/img/sumorobot_interface_blockly.png)

## Instructions

You can copy the whole repository and serve it from somewhere else. For setting up the nginx server with nchan check out the installation instructions [here](https://github.com/slact/nchan). Modify the /etc/nginx/nginx.conf to add below config for the nchan WebSocket server.

```bash
server {
    listen 80;
    server_name localhost;
    root /var/www;
    location ~ "^/p2p/([\w\d\-]+)/([\w\d\-]+)" {
        nchan_pubsub websocket;
        nchan_message_buffer_length 0;
        nchan_publisher_channel_id $1/$2;
        nchan_subscriber_channel_id $2/$1;
    }
}
```

Finally change the IP also in [assets/js/main.js](https://github.com/silbo/silbo.github.io/blob/master/assets/js/main.js#L3) and for the SumoRobots either with adafruit-ampy or [SumoManager](https://www.robokoding.com/kits/sumorobot/sumomanager/).

## Support

If you find our work useful, please consider donating : )  
[![Donate using Liberapay](https://liberapay.com/assets/widgets/donate.svg)](https://liberapay.com/robokoding/donate)

## Credits

* ace
* nginx
* nchan
* Google Blockly
* WebSocket
* Lauri Voandi
