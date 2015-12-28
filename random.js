(function(){
  var masterTags = [  "dog",
    "norfolkterrier",
  ];
  var randomTags = [
    "instadog", "dogs", "doglover", "doggie", "dogstagram", "smalldog",
    "dogslife", "adorable", "pets", "dogsofinstagram", "instaterrier",
    "cutedog", "dogoftheday", "animal", "petstagram", "blackandtan",
    "petsofinstagram", "hound", "happy_pet", "terrier", "dailydog",
    "bestwoof"
  ];
  var shuffle = function(arr) {
    var random = arr.map(Math.random);
    arr.sort(function(a, b) {
      return Math.random() - 0.5
    })
    return arr
  }
  var getSuffled = function(){
    var tags = masterTags.concat()
    var rand = shuffle(randomTags).slice(0, randomTags.length * 0.7)
    return shuffle(tags.concat(rand))
  }
  var arrToTagStr = function(arr){
    return arr.map(function(tag){
      return "#" + tag
    }).join(" ")
  }
  $(function(){
    $("#tags").text(arrToTagStr(getSuffled()))
  })
  // Clipboard.js
  new Clipboard('.btn');
})(jQuery)