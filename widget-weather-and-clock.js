/*
                +--------------+
          +---> |class ClockApi| -----+
+---------+     +--------------+      |  
|class Api|                           V
+---------+     +---------------+     +----------------------+
          +---> |class ApiWidget| --> |class WeatherApiWidget|
                +---------------+     +----------------------+
*/

class Api {
  constructor(api, timeRefresh, timeRetry, limitRetry) {
    this.api=!api?null:api;
    this.timeRefresh=!timeRefresh?0:timeRefresh; //delay to refresh request, by default 0 (false)
    this.timeRetry=!timeRetry?0:timeRetry; //delay to retry when response is an error, by default 0 (false)
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
    this.$root=document.createElement('div'); //widget root <tag>
    //get current position in document and place widget root <tag>
    let $script=document.currentScript || (()=> document.getElementsByTagName('script')[-1])();
    $script.parentElement.appendChild(this.$root);
  }

  exportData(res) {
    this.$root.textContent=res;
  }
}

//-----------------------------------------------------------------------------

class WeatherApiWidget extends ApiWidget {

  constructor(latitude, longitude, timeRefresh, remark) {
    super(null, !timeRefresh?900000:timeRefresh); //default refresh 15'

    this.origin='https://gc-info.herokuapp.com'; //'http://localhost:5000';
    this.latitude=!latitude?null:latitude;
    this.longitude=!longitude?null:longitude;
    this.api=`${this.origin}/api/weather?latitude=${this.latitude}&longitude=${this.longitude}`;

    this.$root.innerHTML=`
      <p><span class="location"></span> [<span class="localtime"></span>]</p>
      <p><span class="temperature" style="font-size:1.25em;"></span> &#8451;</p>
      <img class="icon"/>
      <p class="description"></p>
      <p>Υγρασία: <span class="humidity"></span>%</p>
      <p>Άνεμος: <span class="wind"></span></p>
      <div style="font-size:0.75em;">Update: <span class="update"></span></div>
      <div style="font-size:0.75em;">Remark: <span class="remark"></span></div>
    `;

    this.remark=!remark?'':remark;
    this.clock=new ClockApi(null, null, 1000, 8, timestamp=> {
      let date=new Date(timestamp*1000); //unix timestamp is in seconds but js date() is in milliseconds
      let hours='0'+date.getUTCHours();
      let minutes='0'+date.getUTCMinutes();
      this.$root.querySelector('.localtime').textContent=(hours.substr(-2)+':'+minutes.substr(-2));
    });
  
    if (latitude && longitude) {
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

  exportData(res) {
    if (res.weather) {
      this.$root.querySelector('.location').textContent=res.name;
      this.$root.querySelector('.icon').src=`http://openweathermap.org/img/w/${res.weather[0].icon}.png`;
      this.$root.querySelector('.description').textContent=res.weather[0].description;
      this.$root.querySelector('.temperature').textContent=Math.round(Number(res.main.temp));
      this.$root.querySelector('.humidity').textContent=res.main.humidity;
      this.$root.querySelector('.wind').textContent=res.wind.speed;
      this.$root.querySelector('.update').textContent=(new Date).toString().slice(0,24);
    } else {
      this.$root.querySelector('.update').textContent='no response';
    }
    this.$root.querySelector('.remark').textContent=this.remark;
  }
}