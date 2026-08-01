import React,{useEffect,useState} from "react";

import {
View,
Text,
StyleSheet,
ScrollView,
Pressable
} from "react-native";

import {router} from "expo-router";

import {supabase} from "../../services/supabase";


export default function BusinessReviews(){


const [reviews,setReviews]=useState([]);



useEffect(()=>{

loadReviews();

},[]);



async function loadReviews(){


const {
data:{
user
}
}=await supabase.auth.getUser();



if(!user){

return;

}



const {data:claim,error:claimError}=await supabase

.from("claims")

.select("*")

.eq("user_id",user.id)

.eq("status","approved")

.single();



if(claimError){

console.log(claimError);

return;

}



const {data,error}=await supabase

.from("reviews")

.select("*")

.eq("business_id",claim.business_id)

.order(
"created_at",
{
ascending:false
}
);



if(error){

console.log(error);

return;

}



setReviews(data || []);


}



return(

<ScrollView style={styles.container}>


<Text style={styles.title}>
Customer Reviews
</Text>



{reviews.length === 0 &&

<Text>
No reviews yet
</Text>

}



{reviews.map(review=>(

<View

key={review.id}

style={styles.card}

>


<Text style={styles.rating}>
⭐ {review.rating}/5
</Text>



<Text style={styles.comment}>
{review.comment}
</Text>



<Text>
- {review.name || "Guest"}
</Text>



{review.business_response &&

<View style={styles.response}>

<Text>
Business response:
</Text>

<Text>
{review.business_response}
</Text>

</View>

}



{review.challenged &&

<Text style={styles.challenge}>
Review challenged
</Text>

}



<Pressable

style={styles.button}

onPress={()=>
router.push(
`/business/review-action?id=${review.id}`
)
}

>

<Text style={styles.buttonText}>
Manage Review
</Text>

</Pressable>



</View>

))}



</ScrollView>

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

card:{
borderWidth:1,
borderRadius:10,
padding:15,
marginBottom:15
},

rating:{
fontSize:18
},

comment:{
marginTop:10,
marginBottom:10
},

response:{
marginTop:15,
padding:10
},

challenge:{
marginTop:10
},

button:{
backgroundColor:"#222",
padding:15,
borderRadius:10,
marginTop:15
},

buttonText:{
color:"white",
textAlign:"center"
}

});