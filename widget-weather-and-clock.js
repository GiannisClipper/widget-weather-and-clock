/*
                  +----------------+
          +-----> | class ClockApi | -------+
+-----------+     +----------------+        |  
| class Api |                               V
+-----------+     +-----------------+     +------------------------+
          +-----> | class ApiWidget | --> | class WeatherApiWidget |
                  +-----------------+     +------------------------+
*/

class Api {
  constructor(api, timeRefresh, timeRetry, limitRetry) {
    this.api=!api?null:api;
    this.timeRefresh=!timeRefresh?0:timeRefresh; //delay to refresh request (milliseconds), by default 0 (false)
    this.timeRetry=!timeRetry?0:timeRetry; //delay to retry when response is an error (milliseconds), by default 0 (false)
    this.limitRetry=!limitRetry?4:limitRetry; //to control number of retries, by default 4
    this.countRetry;
  }

  run() {
    //first request immediately then according to timeRefresh delay
    this.countRetry=0;
    this.requestApi();
    if (this.timeRefresh)
      setInterval(()=> {
        this.countRetry=0;
        this.requestApi();
      }, Math.max(this.timeRefresh, 5000)); //minimum interval 5''
  }

  requestApi() {
    console.log('requestApi:', this.api);
    fetch(this.api)
    .then(res=> res.json())
    .then(res=> this.exportData(res))
    .catch(err=> {
      console.log('requestApi:', err.message);
      this.countRetry+=1;
      if (this.timeRetry && this.countRetry<=this.limitRetry)
        setTimeout(()=>this.requestApi(), this.timeRetry);
    });
  }

  exportData(res) {
    return res;
  }
}

//-----------------------------------------------------------------------------

class ClockApi extends Api {

  constructor(api, timeRefresh, timeRetry, limitRetry, callback) {
    super(api, 
      !timeRefresh?null:timeRefresh, 
      !timeRetry?null:timeRetry, 
      !limitRetry?null:limitRetry);
    
    this.timestamp;
    this.callback=!callback?(timestamp)=>{return timestamp;}:callback; //to output the time
    this.minuteRefresh; //interval to update time per minute
    this.systemTime; //track system time to quarantee timestamp accuracy (time update is
                    //based on interval and not a request and when pc suspended update stop) 
  }

  exportData(res) {
    //console.log(res.countryName, res.formatted);
    //multiple widgets in same page may have few seconds delay between initializations
    //rounding the seconds widgets time synchronization is more accurate
    this.timestamp=Math.round(Number(res.timestamp)/60)*60;
    this.callback(this.timestamp);
    this.systemTime=Date.now();
    this.minuteRefresh=setInterval(()=> {
      this.systemTime+=60000; //js date in milliseconds
      if (Math.round(this.systemTime/10000)!==Math.round(Date.now()/10000)) { //check accuracy on minutes
        this.run();
        clearInterval(this.minuteRefresh);
      }
      this.timestamp+=60; //unix timestamp in seconds
      this.callback(this.timestamp);
    }, 60000);  //refresh per minute 
  }
}

//-----------------------------------------------------------------------------

class ApiWidget extends Api {

  constructor(api, timeRefresh) {
    super(api, !timeRefresh?null:timeRefresh);
     //define widget's root <tag> and place it in current script position in document
    this.$body=document.createElement('div');  
    let $script=document.currentScript || (()=> document.getElementsByTagName('script')[-1])();
    $script.parentElement.appendChild(this.$body);
  }

  exportData(res) {
    this.$body.textContent=res;
  }
}

//-----------------------------------------------------------------------------

class WeatherApiWidget extends ApiWidget {

  constructor(args) {
    super();
    this.args=args?args:{};
    this.setHTML();
    this.setTooltip(args);
    this.setClock();
    this.setArgs(args);
    this.setStyle(args);

    this.timeRefresh=args['timeRefresh'];
    this.origin='https://gc-info.herokuapp.com'; //'http://localhost:5000';
    this.latitude=args['latitude'];
    this.longitude=args['longitude'];
    this.api=`${this.origin}/api/weather?latitude=${this.latitude}&longitude=${this.longitude}`;
  
    if (this.latitude && this.longitude) {
      this.run();
      this.clock.api=`${this.origin}/api/clock?latitude=${this.latitude}&longitude=${this.longitude}`;
      this.clock.run();
    } else {
      fetch('https://ipapi.co/json/')
      .then(res=> res.json())
      .then(res=> {
        this.latitude=res.latitude;
        this.longitude=res.longitude;
        this.api=`${this.origin}/api/weather?latitude=${this.latitude}&longitude=${this.longitude}`;
        this.run();
        this.clock.api=`${this.origin}/api/clock?latitude=${this.latitude}&longitude=${this.longitude}`;
        this.clock.run();
      })
      .catch(err=> consolre.log('ipapi.co:', err.message));
    }
  }

  setHTML() {
    this.$body.className='widget-weather-and-clock';
    this.$body.innerHTML=`
      <p><span class="location"></span><span class="localtime"></span></p>
      <p><span class="temperature"></span> &#8451;</p>
      <img class="icon"/>
      <p class="description"></p>
      <p>ΥΓΡΑΣΙΑ <span class="humidity"></span>%</p>
      <p>ΑΝΕΜΟΣ <span class="wind"></span></p>
      <span class="tooltip"><div class="args"></div><div class="update"></div></span>  
    `;
  }

  setTooltip(args) {
    this.$body.querySelector('.args').innerHTML=`
      latitude: ${args['latitude']?args['latitude']+' (user)':'Auto detected IP (default)'}<br>
      longitude: ${args['longitude']?args['longitude']+' (user)':'Auto detected IP (default)'}<br>
      timeRefresh: ${args['timeRefresh']?args['timeRefresh']/60000+'\' (user)':'15\' (default)'}<br>
      width: ${args['width']?args['width']+'px (user)':'200px (default)'}<br>
      border: ${args['border']?args['border']+' (user)':'0px (default)'}<br>
      background: ${args['background']?args['background']+' (user)':'lightskyblue (default)'}<br>
      color: ${args['color']?args['color']+' (user)':'brown (default)'}<br>
    `;

    this.$body.addEventListener('mouseover', ()=>this.$body.querySelector('.tooltip').style.visibility='visible'); 
    this.$body.addEventListener('mouseout', ()=>this.$body.querySelector('.tooltip').style.visibility='hidden'); 
  }

  setClock() {
    this.clock=new ClockApi(null, null, 1000, 8, timestamp=> {
      let date=new Date(timestamp*1000); //unix timestamp is in seconds but js date() is in milliseconds
      let hours='0'+date.getUTCHours();
      let minutes='0'+date.getUTCMinutes();
      this.$body.querySelector('.localtime').textContent=(hours.substr(-2)+':'+minutes.substr(-2));
    });
  }

  setArgs(args) {
    args['latitude']=args['latitude']?args['latitude']:null;
    args['longitude']=args['longitude']?args['longitude']:null;
    args['timeRefresh']=args['timeRefresh']?args['timeRefresh']:900000; //default refresh 15'
    args['width']=args['width']?`${parseInt(args['width'])}px`:'200px';
    args['border']=args['border']?args['border']:'0px';
    args['background']=args['background']?args['background']:'lightskyblue';
    args['color']=args['color']?args['color']:'brown';
    args['font-size']=`${Math.round(parseInt(args['width'])/14)}px`;
  }

  setStyle(args) {    
    this.$body.style.width=args['width'];
    this.$body.style.border=args['border'];
    this.$body.style.background=args['background']; 
    this.$body.style.fontSize=args['font-size'];
    this.$body.style.color=args['color'];

    this.$body.querySelector('.location').style.fontSize='1.25em';
    this.$body.querySelector('.localtime').style.border=`1px dotted ${args['color']}`;
    this.$body.querySelector('.temperature').style.fontSize='1.50em';
    this.$body.querySelector('.description').style.fontSize='1.20em';
    this.$body.querySelector('.tooltip').style.fontSize='0.75em';
  }

  exportData(res) {
    if (res.weather) {
      this.$body.querySelector('.location').textContent=res.name;
      this.$body.querySelector('.icon').src=`http://openweathermap.org/img/w/${res.weather[0].icon}.png`;
      this.$body.querySelector('.description').textContent=res.weather[0].description;
      this.$body.querySelector('.temperature').textContent=Math.round(Number(res.main.temp));
      this.$body.querySelector('.humidity').textContent=res.main.humidity;
      this.$body.querySelector('.wind').textContent=res.wind.speed;
      this.$body.querySelector('.update').textContent=`updated: ${(new Date).toString().slice(16,24)}`;
    } else {
      this.$body.querySelector('.update').textContent='no response';
    }
  }
}

let cssFile='widget-weather-and-clock';
if (!document.querySelector(`#${cssFile}`)) {
    let head=document.getElementsByTagName('head')[0];
    let link=document.createElement('link');
    link.id=cssFile;
    link.rel='stylesheet';
    link.type='text/css';
    link.href=cssFile+'.css';
    link.media='all';
    head.appendChild(link);
}