#ifndef FLASH_ADDRESSES_H
#define FLASH_ADDRESSES_H

//**********FLASH ADDRESSES***********************
//wifi
#define ADDR_SSIDS 0   		  		    	//sizeof = 320
#define ADDR_PWDS 320			        	//sizeof = 320
#define ADDR_WIFI_CONNECT_LOG 640			//sizeof = 4

//xethru
#define ADDR_XETHRU_LED 644		      	//sizeof = 4
#define ADDR_XETHRU_NOISEMAP 648      //sizeof = 4
#define ADDR_XETHRU_SENSITIVITY 652   //sizeof = 4
#define ADDR_XETHRU_MIN_DETECT 656    //sizeof = 4
#define ADDR_XETHRU_MAX_DETECT 660    //sizeof = 4

//im21 door sensor
#define ADDR_IM21_DOORID 664		    	//sizeof = 3

//general device settings
#define ADDR_LOCATION_ID 667          //sizeof = 64
#define ADDR_DEVICE_ID 731            //sizeof = 4
#define ADDR_DEVICE_TYPE 735          //sizeof = 64

#define ADDR_PASSWORD_FOR_SSIDS 799        //sizeof = 64
#define ADDR_PASSWORD_FOR_PASSWORDS 863    //sizeof = 64

//next available memory location is 863+64 = 927

#endif