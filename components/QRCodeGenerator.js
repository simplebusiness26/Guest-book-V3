import React from "react";

import QRCode from "react-native-qrcode-svg";


export default function QRCodeGenerator({
propertyId,
businessId
}){


let url="";



if(propertyId){

url=`https://guestbook.app/guest/${propertyId}`;

}



if(businessId){

url=`https://guestbook.app/business/${businessId}`;

}



return(

<QRCode

value={url}

size={200}

/>

);

}