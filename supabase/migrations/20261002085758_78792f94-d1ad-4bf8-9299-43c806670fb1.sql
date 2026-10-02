insert into public.documents (collection, id, data, owner) values
('settings','public', jsonb_build_object('shipping', jsonb_build_object('standard',2000,'express',5000,'pickup',1000),'freeShippingThreshold',50000,'lowStockThreshold',5,'payment', jsonb_build_object('mobileMoneyEnabled',true,'mobileMoneyNumber','+225 07 00 00 00 00','instructions','Envoyez le montant exact au numéro marchand via Wave / Orange Money / MTN / Moov en indiquant la référence de commande.')), null),
('categories','vetements','{"name":"Vêtements","slug":"vetements","description":"Prêts-à-porter femme, homme et enfant.","image":"/images/products/photo-1445205170230-053b83016050.jpg","order":1}', null),
('categories','chaussures','{"name":"Chaussures","slug":"chaussures","description":"Sandales, baskets, mocassins et talons.","image":"/images/products/gen-sneakers.png","order":2}', null),
('categories','sacs','{"name":"Sacs","slug":"sacs","description":"Sacs à main, cabas et pochettes.","image":"/images/products/photo-1553062407-98eeb64c6a62.jpg","order":3}', null),
('categories','accessoires','{"name":"Accessoires","slug":"accessoires","description":"Bijoux, foulards, ceintures et lunettes.","image":"/images/products/photo-1523275335684-37898b6baf30.jpg","order":4}', null),
('categories','maison','{"name":"Maison","slug":"maison","description":"Bougies, déco et art de vivre.","image":"/images/products/gen-bougie.png","order":5}', null),
('categories','high-tech','{"name":"High-Tech","slug":"high-tech","description":"Audio et objets connectés.","image":"/images/products/photo-1505740420928-5e560c06d30e.jpg","order":6}', null);

insert into public.documents (collection, id, data, owner)
select 'products', p.slug, jsonb_build_object(
  'name',p.name,'slug',p.slug,'description',p.descr,'details',p.descr,
  'price',p.price,'oldPrice',p.old,'image','/images/products/'||p.img,
  'gallery', jsonb_build_array('/images/products/'||p.img),
  'categoryId',p.cat,'categoryName',p.catname,'stock',p.stock,'rating',p.rating,'reviewCount',p.rc,'soldCount',p.sold,
  'isFeatured',p.feat,'isNew',p.isnew,'isActive',true,
  'sizes','[]'::jsonb,'colors','[]'::jsonb,
  'createdAt', jsonb_build_object('__ts', to_char(now() - (p.n||' days')::interval, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
  'updatedAt', jsonb_build_object('__ts', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))), null
from (values
 (1,'Montre classique dorée','montre-classique-doree','Montre élégante au cadran minimaliste et bracelet cuir.',45000,59000,'photo-1523275335684-37898b6baf30.jpg','accessoires','Accessoires',12,4.8,24,58,true,false),
 (2,'Casque audio sans fil','casque-audio-sans-fil','Son immersif, réduction de bruit et 30h d''autonomie.',38000,null,'photo-1505740420928-5e560c06d30e.jpg','high-tech','High-Tech',20,4.6,41,90,true,true),
 (3,'Sac à dos urbain','sac-a-dos-urbain','Sac robuste et élégant, compartiment ordinateur.',25000,32000,'photo-1553062407-98eeb64c6a62.jpg','sacs','Sacs',15,4.5,18,44,true,false),
 (4,'Baskets confort','baskets-confort','Baskets légères pour toute la journée.',29000,null,'gen-sneakers.png','chaussures','Chaussures',30,4.7,33,70,true,true),
 (5,'Bougie parfumée','bougie-parfumee','Cire végétale, notes de vanille et bois de santal.',8500,null,'gen-bougie.png','maison','Maison',40,4.9,52,120,false,true),
 (6,'Enceinte portable','enceinte-portable','Enceinte Bluetooth étanche au son puissant.',22000,27000,'gen-enceinte.png','high-tech','High-Tech',18,4.4,15,36,false,true),
 (7,'Gourde isotherme','gourde-isotherme','Garde au frais 24h et au chaud 12h.',9000,null,'gen-gourde.png','accessoires','Accessoires',50,4.6,22,80,false,false),
 (8,'Lunettes de soleil','lunettes-de-soleil','Verres polarisés et monture légère.',15000,19000,'gen-lunettes.png','accessoires','Accessoires',25,4.5,19,47,true,false),
 (9,'Coffret thé premium','coffret-the-premium','Sélection de thés d''exception.',12000,null,'gen-the.png','maison','Maison',35,4.8,27,63,false,true),
 (10,'Veste en jean','veste-en-jean','Coupe intemporelle, coton résistant.',27000,35000,'photo-1591047139829-d91aecb6caea.jpg','vetements','Vêtements',14,4.6,21,39,true,false),
 (11,'Lampe design','lampe-design','Lumière chaleureuse pour votre intérieur.',31000,null,'photo-1507473885765-e6ed057f782c.jpg','maison','Maison',10,4.7,12,25,false,false),
 (12,'Chemise élégante','chemise-elegante','Chemise ajustée en coton premium.',18000,null,'photo-1445205170230-053b83016050.jpg','vetements','Vêtements',22,4.5,16,31,false,true)
) as p(n,name,slug,descr,price,old,img,cat,catname,stock,rating,rc,sold,feat,isnew);