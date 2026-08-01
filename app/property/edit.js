import React,{useEffect,useState} from "react";

import {
View,
Text,
TextInput,
Pressable,
StyleSheet
} from "react-native";

import {supabase} from "../../services/supabase";

import {router} from "expo-router";


export default function EditProperty(){


const [property,setProperty]=useState(null);


const [name,setName]=useState("");

const [host,setHost]=useState("");

const [description,setDescription]=useState("");

const [bookingUrl,setBookingUrl]=useState("");

const [address,setAddress]=useState("");



useEffect(()=>{

loadProperty();

},[]);



async function loadProperty(){


const {
data:{
user
}
}=await supabase.auth.getUser();



if(!user){

return;

}



const {data:claim,error}=await supabase

.from("claims")

.select("*")

.eq("user_id",user.id)

.eq("status","approved")

.single();



if(error || !claim){

return;

}



const {data}=await supabase

.from("properties")

.select("*")

.eq("id",claim.property_id)

.single();



if(data){

setProperty(data);

setName(data.name || "");

setHost(data.host || "");

setDescription(data.description || "");

setBookingUrl(data.booking_url || "");

setAddress(data.address || "");

}


}



async function save(){


if(!property){

return;

}



const {error}=await supabase

.from("properties")

.update({

name,

host,

description,

booking_url:bookingUrl,

address

})

.eq("id",property.id);



if(error){

console.log(error);

return;

}



router.back();


}



return(

<View style={styles.container}>


<Text style={styles.title}>
Edit Property
</Text>



<TextInput

style={styles.input}

placeholder="Property name"

value={name}

onChangeText={setName}

/>



<TextInput

style={styles.input}

placeholder="Host name"

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



<Pressable

style={styles.button}

onPress={save}

>

<Text style={styles.buttonText}>
Save Changes
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