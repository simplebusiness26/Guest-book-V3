import React,{useState} from "react";

import {
View,
Text,
TextInput,
Pressable,
StyleSheet
} from "react-native";

import {useLocalSearchParams, router} from "expo-router";

import {supabase} from "../../services/supabase";


export default function ReviewAction(){


const {id}=useLocalSearchParams();


const [response,setResponse]=useState("");

const [reason,setReason]=useState("");



async function saveResponse(){


await supabase

.from("reviews")

.update({

business_response:response

})

.eq("id",id);



router.back();


}



async function challenge(){


await supabase

.from("reviews")

.update({

challenged:true,

challenge_reason:reason

})

.eq("id",id);



router.back();


}



return(

<View style={styles.container}>


<Text style={styles.title}>
Manage Review
</Text>



<TextInput

style={styles.input}

placeholder="Business response"

value={response}

onChangeText={setResponse}

/>



<Pressable

style={styles.button}

onPress={saveResponse}

>

<Text style={styles.text}>
Save Reply
</Text>

</Pressable>



<TextInput

style={styles.input}

placeholder="Reason for challenge"

value={reason}

onChangeText={setReason}

/>



<Pressable

style={styles.button}

onPress={challenge}

>

<Text style={styles.text}>
Challenge Review
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
borderRadius:10,
marginTop:10
},

text:{
color:"white",
textAlign:"center"
}

});