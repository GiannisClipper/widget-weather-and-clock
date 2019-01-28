Code developed for demo and educational purposes. Creates one or more widgets inside a web page showing information about the weather and the local time in any place of the world. 

User has to include a tag like <script src='widget-weather-and-clock.js'></script> inside head section and one or more tags like <script>new WeatherApiWidget(latitude, longitude, timeRefresh, remarks);</script> inside body section wherever wish. All the arguments are optional:
- Latitude and longitude (ex. 37.983810, 23.727539) represent location coordinates on the map, if ommitted the code automatically place them with coordinates that corresponds to client IP. 
- TimeRefresh (in milliseconds) define how frequent data refresh, if ommitted the default value is 90000 (15 minutes). 
- Remarks is a simple string displaying at the bottom line of the widget.

Code gets information making requests to third party APIs:
- From api.openweathermap.org gets weather data, with requests commited via gc-info.herokuapp.com (custom server written in Flask/Python) to bypass Cross Origin blocks.
- From api.timezonedb.com gets local times, with requests commited via gc-info.herokuapp.com too.
- From ipapi.co gets location coordinates that corresponds to client IP, with requests straight from the client.

Athens 28 Jan 2019, Giannis Clipper