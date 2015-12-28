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
    return arr.sort(function(a, b) {
      return random[a] - random[b];
    })
    return arr
  }
  var getSuffled = function(){
    var tags = masterTags.concat()
    var rand = shuffle(randomTags).slice(0, randomTags.length * 0.9)
    return tags.concat(rand)
  }
  var arrToTagStr = function(arr){
    return arr.map(function(tag){
      return "#" + tag
    }).join(" ")
  }
  $(function(){
    $("#tags").text(arrToTagStr(getSuffled()))
  })
})(jQuery)