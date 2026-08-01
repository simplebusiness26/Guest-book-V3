import React from "react";
import {
View,
Text,
Pressable,
StyleSheet
} from "react-native";


export default function Categories({onSelect}){


const categories = [
"🍔 Food",
"🍺 Pubs",
"☕ Cafes",
"🏖 Attractions",
"🛒 Shops",
"🚕 Services"
];


return(

<View style={styles.container}>

{categories.map(category=>(

<Pressable

key={category}

style={styles.button}

onPress={()=>onSelect(category)}

>

<Text>
{category}
</Text>

</Pressable>

))}

</View>

);

}



const styles=StyleSheet.create({

container:{
flexDirection:"row",
flexWrap:"wrap",
marginVertical:10
},

button:{
borderWidth:1,
borderRadius:20,
padding:10,
margin:5
}

});