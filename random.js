(function(){
  var masterTags = ["dog", "norfolkterrier"]
  var shuffle = function(arr) {
    var random = arr.map(Math.random);
    arr.sort(function(a, b) {
      return Math.random() - 0.5
    })
    return arr
  }
  var tagLen = function(){ // min = 11 max = 30
    return 25
  }
  var getSuffled = function(randomTags){
    var rand = shuffle(randomTags).slice(0, tagLen())
    return shuffle(rand)
  }
  var arrToTagStr = function(arr){
    return arr.map(function(tag){
      return "#" + tag
    }).join(" ")
  }
  var sanitizeTags = function(arr){
    return arr.sort().filter((x, i, self) => { return self.indexOf(x) === i })
  }
  var loadTags = function(cb){
    $.ajax("./tags.txt", {
      dataType: "text"
    }).then( function(b){
      var tags = b.split("\n").filter(function(tag){
        return tag.length > 0
      })
      cb(sanitizeTags(tags))
    })
  }
  var start = function(){
    // loadTags(function(randomTags){
    //   var selectedTags = getSuffled(randomTags)
    //   var tags = masterTags.concat(selectedTags)
    // 
    //   $("#tags").text(arrToTagStr(tags))
    // })
  }
  //
  $(function(){
    start()
  })
})(jQuery)