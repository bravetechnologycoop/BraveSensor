<?php
$db_name = 'testdb';
$db_user = 'brave';
$db_password = 'brave';
$db_host = 'localhost';


function sendToCurie(){
    $url = "http://localhost:18080/curieservice";
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $server_output = curl_exec($ch);
}

try {
    try {
        $pdo = new PDO("pgsql:host=$db_host;dbname=$db_name", $db_user, $db_password);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        // Check if the 'occupancy' table exists, if not, create it
        $stmt = $pdo->prepare("SELECT to_regclass('public.occupancy')");
        $stmt->execute();
        $table_exists = $stmt->fetchColumn();

        if (!$table_exists) {
            $create_table_sql = "
                CREATE TABLE occupancy (
                    occupied INT,
                    stillness boolean,
                    epochtime TIMESTAMP DEFAULT NOW()
                    );";
            $pdo->exec($create_table_sql);
        }
        //echo "Connected successfully!";
    } catch (PDOException $e) {
        echo "Database connection failed: " . $e->getMessage();
    }
    if (isset($_POST['in'])) {
        $stmt = $pdo->prepare("SELECT occupied FROM occupancy ORDER BY epochtime DESC LIMIT 1");
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $occupied = $row['occupied'];
        $new_occupied = $occupied + 1;
        $stmt = $pdo->prepare("INSERT INTO occupancy (occupied) VALUES (:new_occupied)");
        $stmt->bindParam(':new_occupied', $new_occupied, PDO::PARAM_INT);
        $stmt->execute();
        sendToCurie();
    }

    if (isset($_POST['out'])) {
        $stmt = $pdo->prepare("SELECT occupied FROM occupancy ORDER BY epochtime DESC LIMIT 1");
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $occupied = $row['occupied'];
        if($occupied){
            $new_occupied = $occupied - 1;
            $stmt = $pdo->prepare("INSERT INTO occupancy (occupied) VALUES (:new_occupied)");
            $stmt->bindParam(':new_occupied', $new_occupied, PDO::PARAM_INT);
            $stmt->execute();
            sendToCurie();
        }
    }

    if (isset($_POST['stillness'])) {
        $stmt = $pdo->prepare("SELECT stillness, occupied FROM occupancy ORDER BY epochtime DESC LIMIT 1");
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $stillness = $row['stillness'];
        $occupied = $row['occupied'];
        if(!$stillness && $occupied >= 1){
            $new_stillness = 1;
            $stmt = $pdo->prepare("UPDATE occupancy SET stillness = :new_stillness WHERE epochtime = (SELECT MAX(epochtime) FROM occupancy)");
            $stmt->bindParam(':new_stillness', $new_stillness, PDO::PARAM_INT);
            $stmt->execute();
        } else {
            echo "We need occupied to be at least 1 to have stillness";
        }
    }

    $stmt = $pdo->prepare("SELECT occupied, stillness, epochtime FROM occupancy ORDER BY epochtime DESC LIMIT 1");
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $current_occupied = $row['occupied'];
    $current_stillness = $row['stillness'] ? 'true' : 'false';    
    $epochtime = $row['epochtime'];

    $stmt = $pdo->prepare("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    $stmt->execute();
    $tables = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $selected_table = null;
    $table_data = null;
    if (isset($_POST['table'])) {
        $selected_table = $_POST['table'];
        $stmt = $pdo->prepare("SELECT * FROM $selected_table ORDER BY epochtime DESC LIMIT 10");
        $stmt->execute();
        $table_data = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

} catch (PDOException $e) {
    echo 'Database error: ' . $e->getMessage();
}
?>

<html>
<head>
    <title>Web Interface</title>
</head>
<body>
    <h1 align="center">Bathroom Counter</h1>
    <h2 align="center">Occupied: <?php echo $current_occupied; ?></h2>
    <h3 align="center">Stillness: <?php echo $current_stillness; ?></h3>
    <h4 align="center">Last Updated: <?php echo $epochtime; ?></h4>
    <h5 align="center"><a href="thermalCamera.php">Go to Thermal Camera</a></h5>
    <h6 align="center"><a href="lidar.php">Go to Lidar</a></h6>


    <div style="text-align: center;">
        <form method="POST">
            <button type="submit" name="in">IN</button>
            <button type="submit" name="out">OUT</button>
            <button type="submit" name="stillness">STILLNESS</button>
        </form>
    </div>

    <br>
    <div style="text-align: center;">
        <form method="POST">
            <label for="table">Select Table:</label>
            <select id="table" name="table" onchange="this.form.submit()">
                <option value="">--Select a Table--</option>
                <?php foreach ($tables as $table): ?>
                    <option value="<?php echo $table['table_name']; ?>" <?php echo ($selected_table == $table['table_name']) ? 'selected' : ''; ?>>
                        <?php echo $table['table_name']; ?>
                    </option>
                <?php endforeach; ?>
            </select>
        </form>
    </div>

    <?php if ($selected_table): ?>
        <h2 align="center">Data from Table: <?php echo htmlspecialchars($selected_table); ?></h2>
        <div style="text-align: center;">
            <?php
            if ($table_data) {
                echo "<table border='1' style='margin: 20px auto;'><tr>";
                foreach (array_keys($table_data[0]) as $column) {
                    echo "<th>" . htmlspecialchars($column) . "</th>";
                }
                echo "</tr>";
                foreach ($table_data as $row) {
                    echo "<tr>";
                    foreach ($row as $value) {
                        echo "<td>" . htmlspecialchars($value) . "</td>";
                    }
                    echo "</tr>";
                }
                echo "</table>";
            } else {
                echo "No data available for this table.";
            }
            ?>
        </div>
    <?php endif; ?>
</body>
</html>
