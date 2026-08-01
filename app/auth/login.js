import React,{useState} from "react";

import {
View,
Text,
TextInput,
Pressable,
StyleSheet,
Alert,
ActivityIndicator
} from "react-native";

import {supabase} from "../../services/supabase";

import {router} from "expo-router";


export default function Login(){


const [email,setEmail]=useState("");

const [password,setPassword]=useState("");

const [error,setError]=useState("");

const [loading,setLoading]=useState(false);



async function login(){


setError("");



if(!email || !password){

setError("Please enter your email and password");

return;

}



try{


setLoading(true);



const {
data,
error
}=await supabase.auth.signInWithPassword({

email:email.trim(),

password

});



if(error){

throw error;

}



router.replace("/");



}

catch(error){


console.log(error);



let message="Login failed";



if(error.message.includes("Invalid login")){

message="Incorrect email or password";

}

else{

message=error.message;

}



setError(message);



}

finally{


setLoading(false);


}



}



return(

<View style={styles.container}>


<Text style={styles.title}>
Login
</Text>



<TextInput

style={styles.input}

placeholder="Email"

autoCapitalize="none"

keyboardType="email-address"

value={email}

onChangeText={setEmail}

/>



<TextInput

style={styles.input}

placeholder="Password"

secureTextEntry

value={password}

onChangeText={setPassword}

/>



{error !== "" &&

<Text style={styles.error}>
{error}
</Text>

}



<Pressable

style={styles.button}

onPress={login}

disabled={loading}

>

{

loading

?

<ActivityIndicator color="white"/>

:

<Text style={styles.buttonText}>
Login
</Text>

}


</Pressable>



<Pressable

style={styles.signup}

onPress={()=>router.push("/auth/signup")}

>

<Text>
Don't have an account? Create one
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
fontSize:32,
fontWeight:"bold",
marginBottom:30
},

input:{
borderWidth:1,
borderRadius:10,
padding:15,
marginBottom:15
},

button:{
backgroundColor:"#222",
padding:15,
borderRadius:10,
alignItems:"center"
},

buttonText:{
color:"white",
textAlign:"center"
},

error:{
color:"red",
marginBottom:15
},

signup:{
marginTop:20,
alignItems:"center"
}

});