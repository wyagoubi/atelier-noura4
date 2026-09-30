const demoProducts = [
  {
    id:1,
    name:"Noura Tote",
    category:"bags",
    price:"4,800 DA"
  },
  {
    id:2,
    name:"Lina Mini",
    category:"bags",
    price:"3,600 DA"
  },
  {
    id:3,
    name:"Sahara Skirt",
    category:"skirts",
    price:"6,200 DA"
  },
  {
    id:4,
    name:"Noura Scarf",
    category:"accessories",
    price:"2,200 DA"
  },
  {
    id:5,
    name:"Atelier Pouch",
    category:"accessories",
    price:"2,800 DA"
  },
  {
    id:6,
    name:"Dune Skirt",
    category:"skirts",
    price:"5,900 DA"
  }
];


function getImages(){

  return JSON.parse(
    localStorage.getItem("productImages") || "{}"
  );

}


function saveImages(x){

  localStorage.setItem(
    "productImages",
    JSON.stringify(x)
  );

}


function adminRender(tab = "overview"){

  const root =
    document.getElementById("adminApp");

  if(!root) return;


  const order =
    JSON.parse(
      localStorage.getItem("demoOrder") || "null"
    );


  const images = getImages();


  if(tab === "overview"){

    root.innerHTML = `

      <p class="eyebrow">
        ATELIER NOURA
      </p>

      <h1 class="dash-title">
        Owner Studio
      </h1>


      <div class="stats">

        <div class="stat">

          <span>Products</span>

          <b>
            ${demoProducts.length}
          </b>

        </div>


        <div class="stat">

          <span>Orders</span>

          <b>
            ${order ? 1 : 0}
          </b>

        </div>


        <div class="stat">

          <span>Product images</span>

          <b>
            ${Object.keys(images).length}
          </b>

        </div>


        <div class="stat">

          <span>Status</span>

          <b>
            Ready
          </b>

        </div>

      </div>


      <div class="admin-card">

        <h3>
          إدارة المتجر
        </h3>

        <p>

          من هنا يمكنك تغيير صورة
          أي لباس أو حقيبة أو إكسسوار.

          التغيير يظهر مباشرة في واجهة
          المتجر على نفس المتصفح.

        </p>

      </div>

    `;

  }


  if(tab === "products"){

    root.innerHTML = `

      <p class="eyebrow">
        CATALOG
      </p>

      <h1 class="dash-title">
        Products
      </h1>


      <div class="admin-card">

        <p class="form-note">

          اختاري المنتج ثم ارفعي صورته.

          يمكنك استبدال الصورة في أي وقت
          أو حذفها.

        </p>


        <div class="admin-product-list">

          ${
            demoProducts.map(p => `

              <div class="admin-product-row">


                <div class="admin-product-preview">

                  ${
                    images[p.id]

                      ?

                      `
                      <img
                        src="${images[p.id]}"
                        alt="${p.name}"
                      >
                      `

                      :

                      `
                      <span>
                        NO IMAGE
                      </span>
                      `
                  }

                </div>


                <div class="admin-product-main">

                  <strong>
                    ${p.name}
                  </strong>


                  <small>
                    ${p.category} · ${p.price}
                  </small>


                  <div class="admin-product-actions">

                    <label class="upload-btn">

                      تغيير الصورة

                      <input
                        type="file"
                        accept="image/*"
                        data-product-upload="${p.id}"
                      >

                    </label>


                    ${
                      images[p.id]

                        ?

                        `
                        <button
                          class="danger-btn"
                          onclick="removeProductImage(${p.id})"
                        >
                          حذف الصورة
                        </button>
                        `

                        :

                        ""
                    }

                  </div>

                </div>

              </div>

            `).join("")
          }

        </div>

      </div>

    `;

  }


  if(tab === "orders"){

    root.innerHTML = `

      <p class="eyebrow">
        ORDERS
      </p>

      <h1 class="dash-title">
        Orders
      </h1>


      <div class="admin-card">

        ${
          order

            ?

            `
            <table class="admin-table">

              <tr>

                <th>
                  Order
                </th>

                <th>
                  Customer
                </th>

                <th>
                  Wilaya
                </th>

                <th>
                  Total
                </th>

                <th>
                  Status
                </th>

              </tr>


              <tr>

                <td>
                  ${order.no}
                </td>

                <td>
                  ${order.data.name}
                </td>

                <td>
                  ${order.data.wilaya}
                </td>

                <td>
                  ${order.total.toLocaleString()} DA
                </td>

                <td>
                  New
                </td>

              </tr>

            </table>
            `

            :

            `
            <div class="empty">

              لا توجد طلبات محلية حاليًا.

            </div>
            `
        }

      </div>

    `;

  }


  if(tab === "media"){

    root.innerHTML = `

      <p class="eyebrow">
        MEDIA STUDIO
      </p>

      <h1 class="dash-title">
        Media
      </h1>


      <div class="admin-card">

        <div class="media-upload">

          <h3>
            Upload images & videos
          </h3>


          <p>

            يمكنك حفظ صور أو فيديوهات
            للهوية البصرية.

            صور المنتجات الأفضل إدارتها
            من قسم Products.

          </p>


          <input
            id="mediaInput"
            type="file"
            accept="image/*,video/*"
            multiple
          >

        </div>


        <div
          id="mediaList"
          class="media-list"
        ></div>

      </div>

    `;


    renderMedia();

  }


  if(tab === "settings"){

    root.innerHTML = `

      <p class="eyebrow">
        STORE SETTINGS
      </p>


      <h1 class="dash-title">
        Settings
      </h1>


      <div class="admin-card">

        <label>

          Store name

          <input
            value="Atelier Noura"
            style="
              display:block;
              width:100%;
              padding:12px;
              margin-top:8px
            "
          >

        </label>


        <p class="form-note">

          هذه النسخة ما زالت Demo محليًا.

          عند ربط Supabase سيتم نقل
          المنتجات والصور إلى Storage
          وقاعدة البيانات مع صلاحيات المالك.

        </p>

      </div>

    `;

  }


  if(tab === "products"){

    document
      .querySelectorAll("[data-product-upload]")
      .forEach(input => {

        input.addEventListener(
          "change",
          e => {

            uploadProductImage(
              Number(
                e.target.dataset.productUpload
              ),
              e.target.files[0]
            );

          }
        );

      });

  }

}


function uploadProductImage(id,file){

  if(!file) return;


  if(!file.type.startsWith("image/")){

    alert(
      "اختاري ملف صورة فقط."
    );

    return;

  }


  const reader =
    new FileReader();


  reader.onload = () => {

    const images =
      getImages();


    images[id] =
      reader.result;


    saveImages(images);


    adminRender("products");

  };


  reader.readAsDataURL(file);

}


function removeProductImage(id){

  const images =
    getImages();


  delete images[id];


  saveImages(images);


  adminRender("products");

}


function renderMedia(){

  const list =
    JSON.parse(
      localStorage.getItem("media") || "[]"
    );


  const el =
    document.getElementById("mediaList");


  if(!el) return;


  el.innerHTML = list.map((x,i) => `

    <div class="media-box">

      ${
        x.url &&
        x.type?.startsWith("image/")

          ?

          `
          <img
            src="${x.url}"
            alt="${x.name}"
          >
          `

          :

          ""
      }


      <button
        onclick="deleteMedia(${i})"
      >
        ×
      </button>


      <span>
        ${x.name}
      </span>

    </div>

  `).join("");


  document
    .getElementById("mediaInput")
    ?.addEventListener(
      "change",
      e => {

        const arr =
          JSON.parse(
            localStorage.getItem("media") || "[]"
          );


        [...e.target.files].forEach(f => {

          const reader =
            new FileReader();


          reader.onload = () => {

            arr.push({
              name:f.name,
              type:f.type,
              url:reader.result
            });


            localStorage.setItem(
              "media",
              JSON.stringify(arr)
            );


            renderMedia();

          };


          reader.readAsDataURL(f);

        });


        e.target.value = "";

      }
    );

}


function deleteMedia(i){

  const a =
    JSON.parse(
      localStorage.getItem("media") || "[]"
    );


  a.splice(i,1);


  localStorage.setItem(
    "media",
    JSON.stringify(a)
  );


  renderMedia();

}


document.addEventListener(
  "DOMContentLoaded",
  () => {

    adminRender();


    document
      .querySelectorAll(".admin-tab")
      .forEach(b => {

        b.onclick = () => {

          document
            .querySelectorAll(".admin-tab")
            .forEach(x =>
              x.classList.remove("active")
            );


          b.classList.add("active");


          adminRender(
            b.dataset.tab
          );

        };

      });

  }
);
