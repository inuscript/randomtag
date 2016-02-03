import axios from "axios"

export default function(){
  return axios("./tags.txt").then( res => {
    return res.data.split("\n").filter(function(tag){
      return tag.length > 0
    })
  })
}