use serde::{Serialize, Deserialize};
use serde_json::{Map, Value, json};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Field {
    #[serde(rename = "type")]
    pub r#type: String,
    pub name: String,
    pub description: String,
    pub properties: Option<HashMap<String, Field>>,
    pub required: bool,
}

impl Field {

    pub fn empty() -> Value {
        json!({})
    }

    pub fn as_tool_params(&self) -> Value {
        if let None = &self.properties {
            return Field::empty();
        }
        let mut obj = Map::new();
        obj.insert("type".to_string(), Value::String("object".into()));
        // 处理 properties
        if let Some(props) = &self.properties {
            let mut prop_map = Map::new();
            let mut required_list: Vec<String> = Vec::new();

            for (key, field) in props {
                // 单个字段 schema: type + description (不要 name!)
                let mut field_obj = Map::new();
                field_obj.insert("type".to_string(), Value::String(field.r#type.clone()));
                field_obj.insert("description".to_string(), Value::String(field.description.clone()));

                prop_map.insert(key.clone(), Value::Object(field_obj));

                // 子字段 required=true 加入数组
                if field.required {
                    required_list.push(key.clone());
                }
            }

            obj.insert("properties".to_string(), Value::Object(prop_map));

            if !required_list.is_empty() {
                obj.insert("required".to_string(), Value::Array(
                    required_list.into_iter().map(Value::String).collect()
                ));
            }
        }

        Value::Object(obj)
    }

    
}