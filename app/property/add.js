import React,{useState} from "react";

import {
View,
Text,
TextInput,
Pressable,
StyleSheet
} from "react-native";

import {supabase} from "../../services/supabase";

import {router} from "expo-router";


export default function AddProperty(){


const [name,setName]=useState("");

const [host,setHost]=useState("");

const [description,setDescription]=useState("");

const [bookingUrl,setBookingUrl]=useState("");

const [address,setAddress]=useState("");

const [latitude,setLatitude]=useState("");

const [longitude,setLongitude]=useState("");



async function addProperty(){


const {
data:{
user
}
}=await supabase.auth.getUser();



if(!user){

return;

}



const {error}=await supabase

.from("properties")

.insert({

name,

host,

description,

booking_url:bookingUrl,

address,

latitude:Number(latitude),

longitude:Number(longitude),

owner_id:user.id

});



if(error){

console.log(error);

return;

}



router.back();


}



return(

<View style={styles.container}>


<Text style={styles.title}>
Add Property
</Text>



<TextInput

style={styles.input}

placeholder="Property Name"

value={name}

onChangeText={setName}

/>



<TextInput

style={styles.input}

placeholder="Host Name"

value={host}

onChangeText={setHost}

/>



<TextInput

style={styles.input}

placeholder="Description"

value={description}

onChangeText={setDescription}

/>



<TextInput

style={styles.input}

placeholder="Booking URL"

value={bookingUrl}

onChangeText={setBookingUrl}

/>



<TextInput

style={styles.input}

placeholder="Address"

value={address}

onChangeText={setAddress}

/>



<TextInput

style={styles.input}

placeholder="Latitude"

value={latitude}

onChangeText={setLatitude}

/>



<TextInput

style={styles.input}

placeholder="Longitude"

value={longitude}

onChangeText={setLongitude}

/>



<Pressable

style={styles.button}

onPress={addProperty}

>

<Text style={styles.buttonText}>
Create Property Listing
</Text>

</Pressable>



</View>

);

}



const styles=StyleSheet.create({

container:{
padding:20
},

title:{
fontSize:30,
fontWeight:"bold",
marginBottom:20
},

input:{
borderWidth:1,
padding:15,
borderRadius:10,
marginBottom:15
},

button:{
backgroundColor:"#222",
padding:15,
borderRadius:10
},

buttonText:{
color:"white",
textAlign:"center"
}

});