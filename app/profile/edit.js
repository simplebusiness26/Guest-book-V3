import React,{useEffect,useState} from "react";

import {
View,
Text,
TextInput,
Pressable,
StyleSheet,
Image
} from "react-native";

import * as ImagePicker from "expo-image-picker";

import {supabase} from "../../services/supabase";

import {router} from "expo-router";


export default function EditProfile(){


const [name,setName]=useState("");

const [phone,setPhone]=useState("");

const [bio,setBio]=useState("");

const [photo,setPhoto]=useState("");

const [file,setFile]=useState(null);



useEffect(()=>{

loadProfile();

},[]);





async function loadProfile(){


const {
data:{
user
}
}=await supabase.auth.getUser();



if(!user){

return;

}



const {
data,
error
}=await supabase

.from("profiles")

.select("*")

.eq("id",user.id)

.single();



if(error){

console.log(error.message);

return;

}



if(data){

setName(data.full_name || "");

setPhone(data.phone || "");

setBio(data.bio || "");

setPhoto(data.profile_photo || "");

}


}





async function pickImage(){


const result = await ImagePicker.launchImageLibraryAsync({

mediaTypes:ImagePicker.MediaTypeOptions.Images,

quality:0.7

});



if(!result.canceled){

setFile(result.assets[0]);

setPhoto(result.assets[0].uri);

}


}





async function saveProfile(){


const {
data:{
user
}
}=await supabase.auth.getUser();



if(!user){

return;

}



let imageUrl=photo;



if(file){


const response = await fetch(file.uri);

const blob = await response.blob();



const filename =
`${user.id}.jpg`;



const {
error
}=await supabase.storage

.from("profile-images")

.upload(filename,blob,{
contentType:"image/jpeg",
upsert:true
});



if(error){

console.log(error.message);

return;

}



const {
data
}=supabase.storage

.from("profile-images")

.getPublicUrl(filename);



imageUrl=data.publicUrl;


}





const {
error
}=await supabase

.from("profiles")

.update({

full_name:name.trim(),

phone:phone.trim(),

bio:bio.trim(),

profile_photo:imageUrl

})

.eq("id",user.id);



if(error){

console.log(error.message);

return;

}



router.back();


}





return(

<View style={styles.container}>


<Text style={styles.title}>
Edit Profile
</Text>




{
photo &&

<Image

source={{uri:photo}}

style={styles.image}

/>

}





<Pressable

style={styles.button}

onPress={pickImage}

>

<Text style={styles.text}>
Choose Profile Photo
</Text>

</Pressable>





<TextInput

style={styles.input}

placeholder="Name"

value={name}

onChangeText={setName}

/>





<TextInput

style={styles.input}

placeholder="Phone number"

keyboardType="phone-pad"

value={phone}

onChangeText={setPhone}

/>





<TextInput

style={styles.input}

placeholder="Bio about you"

value={bio}

onChangeText={setBio}

/>





<Pressable

style={styles.button}

onPress={saveProfile}

>

<Text style={styles.text}>
Save Profile
</Text>

</Pressable>





</View>

);

}





const styles=StyleSheet.create({

container:{
padding:30
},


title:{
fontSize:30,
fontWeight:"bold",
marginBottom:20
},


image:{
width:120,
height:120,
borderRadius:60,
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
borderRadius:10,
marginTop:10
},


text:{
color:"white",
textAlign:"center"
}


});