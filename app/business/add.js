import React, { useState } from "react";

import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";

import { supabase } from "../../services/supabase";
import { router } from "expo-router";


export default function AddBusiness() {

  const [name,setName] = useState("");
  const [category,setCategory] = useState("");
  const [description,setDescription] = useState("");
  const [address,setAddress] = useState("");
  const [website,setWebsite] = useState("");
  const [phone,setPhone] = useState("");
  const [openingHours,setOpeningHours] = useState("");
  const [latitude,setLatitude] = useState("");
  const [longitude,setLongitude] = useState("");

  const [loading,setLoading] = useState(false);


  async function addBusiness(){

    if(loading) return;


    if(!name.trim()){
      Alert.alert("Error","Business name is required");
      return;
    }


    if(!category.trim()){
      Alert.alert("Error","Category is required");
      return;
    }


    if(!address.trim()){
      Alert.alert("Error","Address is required");
      return;
    }


    if(isNaN(Number(latitude))){
      Alert.alert("Error","Latitude must be a number");
      return;
    }


    if(isNaN(Number(longitude))){
      Alert.alert("Error","Longitude must be a number");
      return;
    }


    setLoading(true);


    try{


      const {
        data:{user},
        error:userError
      } = await supabase.auth.getUser();


      if(userError) throw userError;


      if(!user){

        Alert.alert(
          "Error",
          "You must be logged in"
        );

        setLoading(false);
        return;

      }



      const {error} = await supabase
      .from("businesses")
      .insert({

        owner_id:user.id,

        name:name.trim(),

        category:category.trim(),

        description:description.trim(),

        address:address.trim(),

        website:website.trim(),

        phone:phone.trim(),

        opening_hours:openingHours.trim(),

        latitude:Number(latitude),

        longitude:Number(longitude),

        claimed:true

      });



      if(error){

        console.log(error);

        Alert.alert(
          "Database Error",
          error.message
        );

        setLoading(false);

        return;

      }



      setLoading(false);

      router.back();



    }catch(error){


      console.log(error);


      Alert.alert(
        "Error",
        error.message
      );


      setLoading(false);


    }


  }



return(

<ScrollView
style={styles.container}
contentContainerStyle={{
paddingBottom:40
}}
>


<Text style={styles.title}>
Add Business
</Text>



<TextInput
style={styles.input}
placeholder="Business Name *"
value={name}
onChangeText={setName}
/>


<TextInput
style={styles.input}
placeholder="Category *"
value={category}
onChangeText={setCategory}
/>


<TextInput
style={styles.input}
placeholder="Description"
value={description}
onChangeText={setDescription}
/>


<TextInput
style={styles.input}
placeholder="Address *"
value={address}
onChangeText={setAddress}
/>


<TextInput
style={styles.input}
placeholder="Website"
value={website}
onChangeText={setWebsite}
/>


<TextInput
style={styles.input}
placeholder="Phone"
value={phone}
onChangeText={setPhone}
/>


<TextInput
style={styles.input}
placeholder="Opening Hours"
value={openingHours}
onChangeText={setOpeningHours}
/>


<TextInput
style={styles.input}
placeholder="Latitude"
value={latitude}
onChangeText={setLatitude}
keyboardType="numeric"
/>


<TextInput
style={styles.input}
placeholder="Longitude"
value={longitude}
onChangeText={setLongitude}
keyboardType="numeric"
/>



<Pressable

style={[
styles.button,
loading && styles.disabled
]}

disabled={loading}

onPress={addBusiness}

>


{
loading ?

<ActivityIndicator color="white"/>

:

<Text style={styles.buttonText}>
Create Business Listing
</Text>

}


</Pressable>


</ScrollView>

);

}



const styles = StyleSheet.create({

container:{
flex:1,
padding:20
},


title:{
fontSize:30,
fontWeight:"bold",
marginBottom:20
},


input:{
borderWidth:1,
borderColor:"#ccc",
padding:15,
borderRadius:10,
marginBottom:15
},


button:{
backgroundColor:"#222",
padding:16,
borderRadius:10,
alignItems:"center"
},


disabled:{
backgroundColor:"#777"
},


buttonText:{
color:"white",
fontWeight:"bold"
}

});