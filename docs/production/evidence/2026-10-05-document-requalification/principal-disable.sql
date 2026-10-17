UPDATE security_internal.document_delivery_principals SET enabled=false WHERE user_id='378b431f-f043-489c-820b-347901a78d11' AND enabled=true RETURNING now() observed_at,user_id,enabled,expires_at;
