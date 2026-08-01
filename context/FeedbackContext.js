import React,{createContext,useContext,useEffect,useRef,useState} from "react";
import {View,Text,Pressable,StyleSheet} from "react-native";

const FeedbackContext=createContext(null);

export function FeedbackProvider({children}){
  const [notice,setNotice]=useState(null);
  const timerRef=useRef(null);

  useEffect(()=>{
    return()=>{
      if(timerRef.current) clearTimeout(timerRef.current);
    };
  },[]);

  function clearFeedback(){
    if(timerRef.current){
      clearTimeout(timerRef.current);
      timerRef.current=null;
    }
    setNotice(null);
  }

  function showFeedback(message,type="success",title){
    if(timerRef.current) clearTimeout(timerRef.current);

    const defaultTitle=type==="error"
      ? "Something went wrong"
      : type==="info"
        ? "Update"
        : "Change confirmed";

    setNotice({message,type,title:title || defaultTitle});
    timerRef.current=setTimeout(()=>{
      setNotice(null);
      timerRef.current=null;
    },4500);
  }

  return(
    <FeedbackContext.Provider value={{showFeedback,clearFeedback}}>
      <View style={styles.app}>
        {children}

        {!!notice && (
          <View
            accessibilityRole="alert"
            style={[
              styles.banner,
              notice.type==="error"
                ? styles.errorBanner
                : notice.type==="info"
                  ? styles.infoBanner
                  : styles.successBanner
            ]}
          >
            <View style={styles.iconWrap}>
              <Text style={styles.icon}>
                {notice.type==="error" ? "!" : notice.type==="info" ? "i" : "✓"}
              </Text>
            </View>

            <View style={styles.textWrap}>
              <Text style={styles.title}>{notice.title}</Text>
              <Text style={styles.message}>{notice.message}</Text>
            </View>

            <Pressable
              accessibilityLabel="Dismiss confirmation"
              style={styles.closeButton}
              onPress={clearFeedback}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>
        )}
      </View>
    </FeedbackContext.Provider>
  );
}

export function useFeedback(){
  const value=useContext(FeedbackContext);

  if(!value){
    throw new Error("useFeedback must be used inside FeedbackProvider");
  }

  return value;
}

const styles=StyleSheet.create({
  app:{flex:1},
  banner:{
    position:"absolute",
    top:76,
    left:12,
    right:12,
    zIndex:9999,
    elevation:20,
    borderRadius:14,
    borderWidth:1,
    padding:14,
    flexDirection:"row",
    alignItems:"center",
    shadowColor:"#000",
    shadowOpacity:0.18,
    shadowRadius:10,
    shadowOffset:{width:0,height:4}
  },
  successBanner:{backgroundColor:"#e8f7ed",borderColor:"#91c9a1"},
  errorBanner:{backgroundColor:"#fdebea",borderColor:"#e5a29e"},
  infoBanner:{backgroundColor:"#eaf1ff",borderColor:"#9db8ed"},
  iconWrap:{
    width:32,
    height:32,
    borderRadius:16,
    backgroundColor:"rgba(255,255,255,0.75)",
    alignItems:"center",
    justifyContent:"center"
  },
  icon:{fontSize:18,fontWeight:"bold"},
  textWrap:{flex:1,marginLeft:11},
  title:{fontSize:16,fontWeight:"bold",color:"#1f2933"},
  message:{fontSize:14,color:"#34404a",marginTop:3,lineHeight:19},
  closeButton:{paddingHorizontal:8,paddingVertical:4},
  closeText:{fontSize:26,lineHeight:27,color:"#34404a"}
});
