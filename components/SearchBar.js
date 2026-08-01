import React from "react";
import {
TextInput,
StyleSheet
} from "react-native";


export default function SearchBar({value,onChange}){


return(

<TextInput

style={styles.search}

placeholder="Search places..."

value={value}

onChangeText={onChange}

/>

);

}



const styles=StyleSheet.create({

search:{
borderWidth:1,
borderRadius:10,
padding:15,
margin:10
}

});