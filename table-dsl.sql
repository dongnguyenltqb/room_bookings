create table if not exists rooms
(
	id serial not null
		constraint rooms_pk
			primary key,
	name varchar
);

create table if not exists bookings
(
	room_id integer not null,
	start_time timestamp not null,
	end_time timestamp not null,
	order_id integer not null
);

create index if not exists bookings_room_id_index
	on bookings (room_id);

create index if not exists bookings_order_id_index
	on bookings (order_id);

create table if not exists orders
(
	id serial not null
		constraint orders_pk
			primary key,
	created_at timestamp not null,
	expired_at timestamp not null,
	status varchar not null
);



