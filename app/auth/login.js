import React,{useState} from "react";

import {
View,
Text,
TextInput,
Pressable,
StyleSheet,
ActivityIndicator
} from "react-native";

import {supabase} from "../../services/supabase";
import {router} from "expo-router";

const TEST_PASSWORD="password123";
const TEST_SETUP_TOKEN="P0h11qYVK3Ev_wuTUfQxfLjXxj6rtK4vZf4Evq99xaE";

const TEST_ACCOUNTS={
  m:{label:"Manager",email:"manager@test.com"},
  e:{label:"Explorer",email:"explorer@test.com"},
  events:{label:"Explorer",email:"explorer@test.com"},
  e2:{label:"Explorer 2",email:"explorer2@test.com"}
};

function normaliseAlias(value){
  return value.trim().toLowerCase();
}

export default function Login(){
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  const [quickAccount,setQuickAccount]=useState("");

  async function prepareTestAccount(alias){
    const {data,error:setupError}=await supabase.functions.invoke(
      "guestbook-test-account-setup",
      {
        body:{
          token:TEST_SETUP_TOKEN,
          alias
        }
      }
    );

    if(setupError){
      throw new Error(setupError.message || "Test account setup failed");
    }

    if(!data?.ok){
      throw new Error(data?.error || "Test account setup failed");
    }
  }

  async function signIn(loginEmail,loginPassword,accountLabel="",testAlias=""){
    setError("");
    setLoading(true);
    setQuickAccount(accountLabel);

    try{
      if(testAlias){
        await prepareTestAccount(testAlias);
      }

      const {error:loginError}=await supabase.auth.signInWithPassword({
        email:loginEmail.trim(),
        password:loginPassword
      });

      if(loginError) throw loginError;

      router.replace("/");
    }catch(loginError){
      console.log(loginError);

      if(accountLabel){
        setError(`${accountLabel} quick login failed. Please tap the button again.`);
      }else if(loginError.message?.includes("Invalid login")){
        setError("Incorrect email or password");
      }else{
        setError(loginError.message || "Login failed");
      }
    }finally{
      setLoading(false);
      setQuickAccount("");
    }
  }

  async function login(){
    const alias=normaliseAlias(email);
    const testAccount=TEST_ACCOUNTS[alias];

    if(testAccount && !password){
      await signIn(
        testAccount.email,
        TEST_PASSWORD,
        testAccount.label,
        alias
      );
      return;
    }

    if(!email || !password){
      setError("Enter your email and password, or use a quick test login.");
      return;
    }

    await signIn(email,password);
  }

  async function quickLogin(alias){
    const account=TEST_ACCOUNTS[alias];
    if(!account || loading) return;

    setEmail(alias);
    setPassword("");

    await signIn(
      account.email,
      TEST_PASSWORD,
      account.label,
      alias
    );
  }

  return(
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>

      <View style={styles.quickPanel}>
        <Text style={styles.quickTitle}>Quick test login</Text>
        <Text style={styles.quickHelp}>
          Tap an account below. No password typing is needed.
        </Text>

        <View style={styles.quickRow}>
          <Pressable
            style={[styles.quickButton,loading && styles.disabledButton]}
            onPress={()=>quickLogin("m")}
            disabled={loading}
          >
            {loading && quickAccount==="Manager" ? (
              <ActivityIndicator color="white"/>
            ) : (
              <>
                <Text style={styles.quickCode}>M</Text>
                <Text style={styles.quickLabel}>Manager</Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={[styles.quickButton,loading && styles.disabledButton]}
            onPress={()=>quickLogin("e")}
            disabled={loading}
          >
            {loading && quickAccount==="Explorer" ? (
              <ActivityIndicator color="white"/>
            ) : (
              <>
                <Text style={styles.quickCode}>E</Text>
                <Text style={styles.quickLabel}>Explorer</Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={[styles.quickButton,loading && styles.disabledButton]}
            onPress={()=>quickLogin("e2")}
            disabled={loading}
          >
            {loading && quickAccount==="Explorer 2" ? (
              <ActivityIndicator color="white"/>
            ) : (
              <>
                <Text style={styles.quickCode}>E2</Text>
                <Text style={styles.quickLabel}>Explorer 2</Text>
              </>
            )}
          </Pressable>
        </View>

        <Text style={styles.aliasHelp}>
          You can also type m, e, events or e2 in the email box and tap Login.
        </Text>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Email or test alias"
        autoCapitalize="none"
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

      {error!=="" && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.button,loading && styles.disabledButton]}
        onPress={login}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="white"/>
        ) : (
          <Text style={styles.buttonText}>Login</Text>
        )}
      </Pressable>

      <Pressable
        style={styles.signup}
        onPress={()=>router.push("/auth/signup")}
      >
        <Text>Don't have an account? Create one</Text>
      </Pressable>
    </View>
  );
}

const styles=StyleSheet.create({
  container:{padding:30},
  title:{fontSize:32,fontWeight:"bold",marginBottom:24},
  quickPanel:{
    backgroundColor:"#f2f4ff",
    borderWidth:1,
    borderColor:"#cbd3ff",
    borderRadius:14,
    padding:16,
    marginBottom:22
  },
  quickTitle:{fontSize:19,fontWeight:"bold",color:"#1d2b64"},
  quickHelp:{color:"#59617a",lineHeight:20,marginTop:5},
  quickRow:{flexDirection:"row",gap:9,marginTop:14},
  quickButton:{
    flex:1,
    minHeight:76,
    backgroundColor:"#1729bd",
    borderRadius:12,
    alignItems:"center",
    justifyContent:"center",
    paddingHorizontal:5
  },
  quickCode:{color:"white",fontSize:22,fontWeight:"bold"},
  quickLabel:{color:"white",fontSize:11,marginTop:4,textAlign:"center"},
  aliasHelp:{color:"#59617a",fontSize:12,lineHeight:17,marginTop:12},
  input:{borderWidth:1,borderColor:"#aaa",borderRadius:10,padding:15,marginBottom:15},
  button:{backgroundColor:"#222",padding:15,borderRadius:10,alignItems:"center"},
  disabledButton:{opacity:0.55},
  buttonText:{color:"white",textAlign:"center",fontWeight:"bold"},
  error:{color:"red",marginBottom:15,lineHeight:20},
  signup:{marginTop:20,alignItems:"center"}
});