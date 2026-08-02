import React,{useEffect,useRef,useState} from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator
} from "react-native";
import {router} from "expo-router";
import {supabase} from "../../services/supabase";

export default function UpdatePassword(){
  const [checking,setChecking]=useState(true);
  const [canReset,setCanReset]=useState(false);
  const [password,setPassword]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");
  const [loading,setLoading]=useState(false);
  const [complete,setComplete]=useState(false);
  const [error,setError]=useState("");
  const resolvedRef=useRef(false);

  useEffect(()=>{
    let mounted=true;

    function allowReset(){
      if(!mounted) return;
      resolvedRef.current=true;
      setCanReset(true);
      setChecking(false);
      setError("");
    }

    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
      if(event==="PASSWORD_RECOVERY" || session){
        allowReset();
      }
    });

    supabase.auth.getSession().then(({data:{session}})=>{
      if(session) allowReset();
    });

    const timeout=setTimeout(()=>{
      if(!mounted || resolvedRef.current) return;
      setChecking(false);
      setError("This reset link is invalid or has expired. Request a new password-reset email.");
    },2500);

    return()=>{
      mounted=false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  },[]);

  async function savePassword(){
    setError("");

    if(password.length<8){
      setError("Your new password must contain at least 8 characters.");
      return;
    }

    if(password!==confirmPassword){
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);
    const {error:updateError}=await supabase.auth.updateUser({password});

    if(updateError){
      setLoading(false);
      setError(updateError.message || "Your password could not be updated.");
      return;
    }

    await supabase.auth.signOut();
    setLoading(false);
    setComplete(true);
  }

  if(checking){
    return(
      <View style={styles.center}>
        <ActivityIndicator size="large"/>
        <Text style={styles.checkingText}>Checking your reset link...</Text>
      </View>
    );
  }

  if(complete){
    return(
      <View style={styles.container}>
        <View style={styles.successCard}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.title}>Password updated</Text>
          <Text style={styles.message}>
            Your new password is active. Log in again using the new password.
          </Text>
        </View>

        <Pressable style={styles.button} onPress={()=>router.replace("/auth/login")}>
          <Text style={styles.buttonText}>Return to login</Text>
        </Pressable>
      </View>
    );
  }

  if(!canReset){
    return(
      <View style={styles.container}>
        <Text style={styles.title}>Reset link unavailable</Text>
        <Text style={styles.error}>{error}</Text>

        <Pressable style={styles.button} onPress={()=>router.replace("/auth/forgot-password")}>
          <Text style={styles.buttonText}>Request a new link</Text>
        </Pressable>
      </View>
    );
  }

  return(
    <View style={styles.container}>
      <Text style={styles.title}>Set a new password</Text>
      <Text style={styles.message}>
        Choose a password containing at least 8 characters.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="New password"
        secureTextEntry
        autoCapitalize="none"
        value={password}
        onChangeText={setPassword}
      />

      <TextInput
        style={styles.input}
        placeholder="Confirm new password"
        secureTextEntry
        autoCapitalize="none"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      {!!error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.button,loading&&styles.disabledButton]}
        onPress={savePassword}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="white"/>
          : <Text style={styles.buttonText}>Update password</Text>
        }
      </Pressable>
    </View>
  );
}

const styles=StyleSheet.create({
  container:{padding:30},
  center:{flex:1,alignItems:"center",justifyContent:"center",padding:30},
  title:{fontSize:32,fontWeight:"bold",marginBottom:12},
  message:{fontSize:16,lineHeight:23,color:"#666",marginBottom:22},
  checkingText:{marginTop:14,color:"#666"},
  input:{borderWidth:1,borderColor:"#aaa",borderRadius:10,padding:15,marginBottom:15},
  button:{backgroundColor:"#1729bd",padding:16,borderRadius:10,alignItems:"center"},
  disabledButton:{opacity:0.55},
  buttonText:{color:"white",fontWeight:"bold"},
  error:{color:"#c62828",marginBottom:18,lineHeight:21},
  successCard:{borderWidth:1,borderColor:"#91c9a1",backgroundColor:"#e8f7ed",borderRadius:14,padding:20,marginBottom:18},
  successIcon:{fontSize:38,fontWeight:"bold",color:"#1f7135",marginBottom:8}
});